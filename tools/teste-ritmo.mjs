import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function sessionServerRunning() {
  try {
    await fetch("http://127.0.0.1:8765/api/phone", { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

if (await sessionServerRunning()) {
  console.log("The session server is already running on port 8765. Stop it (Desligar servidor) and run this test again.");
  process.exit(1);
}

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9335;
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const FILE_URL = pathToFileURL(join(ROOT, "painel-do-mestre", "index.html")).href;
const profile = mkdtempSync(join(tmpdir(), "op2-cdp-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server = null;
let failures = 0;

function check(label, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail === undefined ? "" : `: ${detail}`}`);
}

async function json(path) {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(200); }
  }
  throw new Error("Chrome did not start");
}

async function evalIn(target, expression) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  const result = await new Promise((done) => {
    ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id === 1) done(msg); };
    ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true, userGesture: true } }));
  });
  ws.close();
  if (result.result && result.result.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
  return result.result && result.result.result ? result.result.result.value : result;
}

async function openTab(url) {
  const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURI(url)}`, { method: "PUT" })).json();
  await sleep(2000);
  return created;
}

const click = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("missing ${selector.replace(/"/g, "'")}"); el.click(); return "ok"; })()`;
const state = "JSON.parse(localStorage.getItem('op2-ato1-painel-v1'))";
const tryCode = (code) => `(() => { const input = document.querySelector('.door-input'); input.value = '${code}'; input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-act=door-try]').click(); return 'ok'; })()`;

async function api(path, body) {
  const res = await fetch(`http://127.0.0.1:8765${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

try {
  await json("/json/version");
  const panel = await openTab(FILE_URL);
  await evalIn(panel, "window.confirm = () => true; 'ok'");
  await evalIn(panel, click("[data-act=tab][data-id=tv]"));
  await evalIn(panel, click("[data-act=tv-open]"));
  await sleep(2500);
  const tv = (await json("/json/list")).find((t) => t.url.endsWith("jogadores.html"));
  check("TV window opened", !!tv);

  const setPlayers = (n) => `(() => { const el = document.querySelector('[data-input=players]'); el.value = '${n}'; el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`;
  const cardCount = "document.querySelectorAll('#chars article.char').length";
  const tvToken = (id) => `(() => { const t = document.querySelector('#tokens [data-token=${id}]'); return t ? { cls: t.className, name: t.textContent.trim() } : null; })()`;

  check("default table has 4 players", (await evalIn(panel, `${state}.players`)) === 4 && (await evalIn(panel, cardCount)) === 4);

  await evalIn(panel, setPlayers(5));
  let tableState = await evalIn(panel, state);
  check("5-player table: Kênia gets a card", (await evalIn(panel, cardCount)) === 5 && (await evalIn(panel, "!!document.querySelector('#chars [data-id=kenia]')")) === true);
  check("5-player table: Edgar and Kênia start unconscious", tableState.chars.edgar.status === "inconsciente" && tableState.chars.kenia.status === "inconsciente");
  await evalIn(panel, click("[data-act=tab][data-id=travas]"));
  check("5-player table: chains lock listed", (await evalIn(panel, "document.body.textContent.includes('Correntes do Edgar')")) === true);
  await sleep(1200);
  check("5-player table: TV shows Kênia", (await evalIn(tv, tvToken("kenia"))) !== null);

  await evalIn(panel, setPlayers(3));
  tableState = await evalIn(panel, state);
  check("3-player table: Edgar starts dead", tableState.chars.edgar.status === "morto", tableState.chars.edgar.status);
  check("3-player table: only playable cards shown", (await evalIn(panel, cardCount)) === 3);
  check("3-player table: Edgar has no card", (await evalIn(panel, "!!document.querySelector('#chars [data-id=edgar]')")) === false);
  check("3-player table: no chains lock", (await evalIn(panel, "document.body.textContent.includes('Correntes do Edgar')")) === false);
  await sleep(1200);
  check("3-player table: TV hides Kênia", (await evalIn(tv, tvToken("kenia"))) === null);
  const edgarToken = await evalIn(tv, tvToken("edgar"));
  check("TV shows the altar body as dead without his name", !!edgarToken && edgarToken.cls.includes("st-morto") && edgarToken.name === "Homem no altar", JSON.stringify(edgarToken));

  await evalIn(panel, `(() => { const s = ${state}; delete s.players; localStorage.setItem('op2-ato1-painel-v1', JSON.stringify(s)); setTimeout(() => location.reload(), 50); return 'ok'; })()`);
  await sleep(2000);
  await evalIn(panel, "window.confirm = () => true; 'ok'");
  check("a panel saved during the 3-player session reopens with 3 players", (await evalIn(panel, cardCount)) === 3 && (await evalIn(panel, "document.querySelector('[data-input=players]').value")) === "3");
  await evalIn(panel, setPlayers(4));
  check("back to 4 players: Edgar is playable again", (await evalIn(panel, `${state}.chars.edgar.status`)) === "inconsciente" && (await evalIn(panel, cardCount)) === 4);

  await evalIn(panel, click("[data-act=tab][data-id=ritmo]"));
  check("rhythm tab shows hint cards", (await evalIn(panel, "document.querySelectorAll('.hint-card').length")) === 8);
  await evalIn(panel, click("[data-act=gustavo-arm]"));
  check("Gustavo armed", (await evalIn(panel, `${state}.gustavo.armed`)) === true);

  await evalIn(panel, click("[data-act=tab][data-id=caminho]"));
  const startRound = await evalIn(panel, `${state}.round`);
  await evalIn(panel, tryCode("160322"));
  let s = await evalIn(panel, state);
  check("correct code does not open the door when armed", s.door.open === false);
  check("door opens three rounds later", s.door.opensAt === startRound + 3, s.door.opensAt);
  check("Gustavo rose", s.gustavo.risen === true);
  check("TV switched to map 02", s.tv.map === "m02", s.tv.map);
  await sleep(1200);
  check("TV shows countdown", (await evalIn(tv, "document.getElementById('door-count').hidden ? '' : document.getElementById('door-count').innerText.replace(/\\s+/g, ' ')")) === "PORTA DESTRAVANDO 3 RODADAS");
  check("TV shows Gustavo token", (await evalIn(tv, "!!document.querySelector('#tokens [data-token=gustavo].tk-monstro')")) === true);

  await evalIn(panel, tryCode("111111"));
  s = await evalIn(panel, state);
  check("wrong code during countdown adds no error", s.door.errors === 0, s.door.errors);

  await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("door still closed after two rounds", s.door.open === false && s.door.opensAt === startRound + 3);
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("door opens on the third round", s.door.open === true && s.door.opensAt === null);
  await sleep(1200);
  check("TV countdown hidden after opening", (await evalIn(tv, "document.getElementById('door-count').hidden")) === true);

  await evalIn(panel, click("[data-act=tab][data-id=ritmo]"));
  await evalIn(panel, click("[data-act=gustavo-hit][data-value='8']"));
  await evalIn(panel, click("[data-act=gustavo-hit][data-value='5']"));
  s = await evalIn(panel, state);
  check("Gustavo goes down at 0 PV", s.gustavo.pv === 0 && s.gustavo.downUntil === s.round + 2, JSON.stringify(s.gustavo));
  await sleep(1200);
  check("TV shows Gustavo fallen", (await evalIn(tv, "document.querySelector('#tokens [data-token=gustavo]').classList.contains('st-inconsciente')")) === true);
  await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("Gustavo gets up with full PV", s.gustavo.downUntil === null && s.gustavo.pv === 12, JSON.stringify(s.gustavo));

  await evalIn(panel, click("[data-act=hint-next][data-id=estante]"));
  s = await evalIn(panel, state);
  check("hint level recorded", s.hintsShown.estante === 1);
  await evalIn(panel, click("#clock-chip"));
  s = await evalIn(panel, state);
  check("session clock starts", s.clock.startedAt !== null);

  const pdMinus = '[data-act=stat][data-id=eloisa][data-stat=pd][data-delta="-1"]';
  await evalIn(panel, click(pdMinus));
  const pdLineText = "document.querySelector('[data-act=stat][data-id=eloisa]').closest('.char').querySelector('.pd-line')?.innerText || ''";
  check("losing PD shows a character line", (await evalIn(panel, pdLineText)).includes("Bruninho"));
  await evalIn(panel, click(pdMinus));
  check("next PD loss rotates the line", !(await evalIn(panel, pdLineText)).includes("Bruninho") && (await evalIn(panel, pdLineText)).length > 0);
  await evalIn(panel, click("[data-act=pd-line-hide][data-id=eloisa]"));
  check("ok hides the PD line", (await evalIn(panel, pdLineText)) === "");
  await evalIn(panel, click(pdMinus.replace('"-1"', '"1"')));
  s = await evalIn(panel, state);
  check("gaining PD keeps the line cleared", s.chars.eloisa.pdLine === null && s.chars.eloisa.pd === 13, JSON.stringify({ pd: s.chars.eloisa.pd, line: s.chars.eloisa.pdLine }));

  await evalIn(panel, click("[data-act=reset]"));
  s = await evalIn(panel, state);
  check("new session clears Gustavo, door and hints", !s.gustavo.armed && !s.gustavo.risen && s.door.opensAt === null && !s.door.open && Object.keys(s.hintsShown).length === 0 && s.clock.startedAt === null);

  await evalIn(panel, click("[data-act=tab][data-id=ritmo]"));
  await evalIn(panel, click("[data-act=gustavo-arm]"));
  await evalIn(panel, click("[data-act=curse-on]"));
  for (let i = 0; i < 11; i++) await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=tab][data-id=caminho]"));
  await evalIn(panel, tryCode("160322"));
  s = await evalIn(panel, state);
  check("late curse: door opens at once, Gustavo stays down", s.door.open === true && !s.gustavo.risen, `curse round ${s.round - s.curseStart}`);

  await evalIn(panel, click("[data-act=reset]"));
  await evalIn(panel, click("[data-act=tab][data-id=ritmo]"));
  await evalIn(panel, click("[data-act=gustavo-arm]"));
  await evalIn(panel, click("[data-act=tab][data-id=caminho]"));
  await evalIn(panel, tryCode("160322"));
  check("rise round tells the GM to read aloud", (await evalIn(panel, "document.getElementById('reminders').innerText")).includes("Leia agora"));
  await evalIn(panel, click("[data-act=breaker][data-id=porao]"));
  await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("countdown holds while the Porão breaker is off", s.door.open === false && s.door.opensAt === s.round + 3, JSON.stringify({ round: s.round, opensAt: s.door.opensAt }));
  await sleep(1200);
  check("TV says the door has no power", (await evalIn(tv, "document.getElementById('door-count').innerText")).includes("SEM ENERGIA"));
  await evalIn(panel, click("[data-act=breaker][data-id=porao]"));
  await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("still closed two rounds after power returns", s.door.open === false);
  await evalIn(panel, click("[data-act=round-next]"));
  s = await evalIn(panel, state);
  check("opens three rounds after power returns", s.door.open === true);
  check("door-open round tells the GM to read aloud", (await evalIn(panel, "document.getElementById('reminders').innerText")).includes("a porta abre"));

  server = spawn("/usr/bin/python3", ["servidor.py", "--no-browser"], { cwd: ROOT, stdio: "ignore" });
  await sleep(1500);
  const served = await openTab("http://localhost:8765/index.html");
  await evalIn(served, "window.confirm = () => true; 'ok'");
  await evalIn(served, click("[data-act=reset]"));
  await evalIn(served, click("[data-act=tab][data-id=ritmo]"));
  await evalIn(served, click("[data-act=gustavo-arm]"));
  await api("/api/gm", { action: "enable", value: true });
  await api("/api/gm", { action: "unlock" });
  const queued = await api("/api/phone", { action: "door", code: "160322" });
  check("phone queued the code", queued.ok === true);
  await sleep(3000);
  s = await evalIn(served, state);
  check("phone code starts the countdown", s.door.open === false && s.door.opensAt === s.round + 3 && s.gustavo.risen, JSON.stringify(s.door));
  const phone = await api("/api/phone");
  check("phone sees the countdown", phone.door && phone.door.opensIn === 3, JSON.stringify(phone.door));
  const phonePage = await openTab("http://localhost:8765/celular.html");
  await sleep(1500);
  await evalIn(phonePage, "(() => { const b = [...document.querySelectorAll('[data-act=open], [data-to], [data-app]')].find((el) => /TRANCATRON/i.test(el.textContent)); if (b) b.click(); return !!b; })()");
  await sleep(500);
  check("TRANCATRON shows destravando and disables keypad", await evalIn(phonePage, "document.body.innerText.includes('Destravando') && document.querySelectorAll('.keypad button').length === 12 && [...document.querySelectorAll('.keypad button')].every((b) => b.disabled)"));

  const LAN = { Host: "192.168.0.50:8765" };
  const raw = (path, headers = {}, method = "GET", body) => new Promise((done) => {
    const req = http.request({ host: "127.0.0.1", port: 8765, path, method, headers }, (res) => { res.resume(); done(res.statusCode); });
    req.on("error", () => done(0));
    if (body) req.write(body);
    req.end();
  });
  check("LAN client cannot climb out of the public folder", (await raw("/assets/fichas-mapa/../../data.js", LAN)) === 403);
  check("LAN client cannot climb out with encoded dots", (await raw("/assets/fichas-mapa/%2e%2e/%2e%2e/data.js", LAN)) === 403);
  check("LAN client still gets the phone page and token images", (await raw("/celular.html", LAN)) === 200 && (await raw("/assets/fichas-mapa/alan.png", LAN)) === 200);
  check("foreign Host cannot read the GM API (DNS rebinding)", (await raw("/api/gm", { Host: "evil.example:8765" })) === 403);
  check("cross-site text/plain post is refused", (await raw("/api/gm", { Host: "localhost:8765", "Content-Type": "text/plain" }, "POST", '{"action":"shutdown"}')) === 415);
  check("server still up after the refused post", (await raw("/api/phone")) === 200);

  const evil = { savedAt: Date.now() + 1e9, round: "<img src=x onerror=\"window.__pwned=1\">", notes: "<script>window.__pwned=2</script>" };
  await fetch(`http://127.0.0.1:${PORT}/json/close/${served.id}`);
  await sleep(300);
  const evilTab = await openTab("http://localhost:8765/celular.html");
  await evalIn(evilTab, `location.href = ${JSON.stringify(`http://localhost:8765/index.html#importar=${encodeURIComponent(JSON.stringify(evil))}`)}; 'ok'`);
  await sleep(2000);
  check("imported state was applied (defanged)", (await evalIn(evilTab, "document.querySelector('.round-num b').textContent")).startsWith("‹img"));
  check("imported state cannot inject HTML", (await evalIn(evilTab, "window.__pwned === undefined && !document.querySelector('img[src=x]')")) === true);
  await evalIn(evilTab, "window.confirm = () => true; 'ok'");
  await evalIn(evilTab, click("[data-act=reset]"));

  await api("/api/gm", { action: "reset" });
} finally {
  chrome.kill();
  if (server) server.kill();
}
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
