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
const PORT = 9334;
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
  return result.result && result.result.result ? result.result.result.value : result;
}

async function openTab(url) {
  const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURI(url)}`, { method: "PUT" })).json();
  await sleep(2000);
  return created;
}

async function serverStatus() {
  try { return (await fetch("http://127.0.0.1:8765/api/gm", { signal: AbortSignal.timeout(1000) })).status; } catch { return 0; }
}

const chipText = "document.querySelector('#srv-chip').innerText.replace(/\\n/g, ' ').toLowerCase()";
const roundText = "document.querySelector('.round-num b').textContent";
const click = (selector) => `document.querySelector(${JSON.stringify(selector)}).click(); 'ok'`;

try {
  check("server is off before test", (await serverStatus()) === 0);
  await json("/json/version");
  const panel = await openTab(FILE_URL);
  check("file panel shows server off", (await evalIn(panel, chipText)) === "servidor desligado ligar", await evalIn(panel, chipText));
  check("phone tab offers start button", await evalIn(panel, `${click("[data-act=tab][data-id=celular]")}; !!document.querySelector('#phone-section [data-act=server-start]')`));
  await evalIn(panel, click("[data-act=round-next]"));
  await evalIn(panel, click("[data-act=round-next]"));
  const fileRound = await evalIn(panel, roundText);
  await evalIn(panel, `${click("[data-act=tab][data-id=tv]")}; ${click("[data-act=tv-open]")}`);
  await sleep(3000);
  check("TV connected to file panel", (await evalIn(panel, "document.querySelector('#tv-chip').innerText.toLowerCase()")).includes("conectada"));

  server = spawn("/usr/bin/python3", ["servidor.py", "--no-browser"], { cwd: ROOT, stdio: "ignore" });
  await sleep(6500);
  check("file panel notices running server", (await evalIn(panel, chipText)) === "servidor ligado abrir painel conectado", await evalIn(panel, chipText));
  await evalIn(panel, click("#srv-chip"));
  await sleep(3000);
  const href = await evalIn(panel, "location.href");
  check("panel moved to localhost without hash", href === "http://localhost:8765/index.html", href);
  check("round carried over", (await evalIn(panel, roundText)) === fileRound, `${await evalIn(panel, roundText)} vs ${fileRound}`);
  check("served panel shows server on", (await evalIn(panel, chipText)) === "servidor ligado", await evalIn(panel, chipText));
  await sleep(2500);
  check("TV reconnects to served panel", (await evalIn(panel, "document.querySelector('#tv-chip').innerText.toLowerCase()")).includes("conectada"));
  const tv = (await json("/json/list")).find((t) => t.url.endsWith("jogadores.html"));
  await evalIn(panel, click("[data-act=curse-on]"));
  await sleep(800);
  check("TV follows served panel", await evalIn(tv, "document.body.classList.contains('cursed')"));

  await evalIn(panel, click("[data-act=round-next]"));
  const newerRound = await evalIn(panel, roundText);
  const stale = await openTab(FILE_URL);
  check("stale file panel still shows the older round", (await evalIn(stale, roundText)) === fileRound);
  await sleep(5500);
  await evalIn(stale, click("[data-act=server-go]"));
  await sleep(3000);
  check("stale file state does not overwrite newer state", (await evalIn(stale, roundText)) === newerRound, `${await evalIn(stale, roundText)} vs ${newerRound}`);

  await evalIn(panel, `window.confirm = () => true; ${click("[data-act=tab][data-id=celular]")}; ${click("[data-act=server-stop]")}`);
  await sleep(1500);
  check("stop button shuts the server down", (await serverStatus()) === 0);
  check("served panel shows server off", (await evalIn(panel, chipText)) === "servidor desligado ligar", await evalIn(panel, chipText));
} finally {
  chrome.kill();
  if (server) server.kill();
}
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
