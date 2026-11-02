import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const url = process.argv[2];
const profile = mkdtempSync(join(tmpdir(), "op2-cdp-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(200); }
  }
  throw new Error("Chrome did not start");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const ready = new Promise((r) => { ws.onopen = r; });
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
  return { ready, send, close: () => ws.close() };
}

async function evalIn(target, expression) {
  const c = connect(target.webSocketDebuggerUrl);
  await c.ready;
  const res = await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  c.close();
  return res.result && res.result.result ? res.result.result.value : res;
}

try {
  await json("/json/version");
  const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURI(url)}`, { method: "PUT" })).json();
  await sleep(2500);
  console.log("gm loaded:", await evalIn(created, "document.title + ' | tabs=' + document.querySelectorAll('#tabs button').length"));
  console.log("open:", await evalIn(created, "document.querySelector('[data-act=tab][data-id=tv]').click(); document.querySelector('[data-act=tv-open]').click(); 'clicked'"));
  await sleep(3500);
  console.log("gm chip:", await evalIn(created, "document.querySelector('#tv-chip').innerText.replace(/\\n/g, ' | ')"));
  const targets = await json("/json/list");
  const tv = targets.find((t) => t.url.endsWith("jogadores.html"));
  console.log("tv target:", tv ? tv.url : "NOT FOUND");
  if (tv) {
    console.log("tv state:", await evalIn(tv, "JSON.stringify({ tokens: document.querySelectorAll('#tokens .tk').length, stageVisible: !document.getElementById('stage').classList.contains('off'), opener: !!window.opener })"));
    await evalIn(created, "document.querySelector('[data-act=curse-on]').click(); 'ok'");
    await sleep(800);
    console.log("tv cursed after GM click:", await evalIn(tv, "document.body.classList.contains('cursed')"));
  }
} finally {
  chrome.kill();
}
