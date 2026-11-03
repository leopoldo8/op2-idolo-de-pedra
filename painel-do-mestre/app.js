(function () {
  "use strict";

  const D = window.DATA;
  const STORAGE_KEY = "op2-ato1-painel-v1";
  const TABS = [
    ["caminho", "Caminho e porta"],
    ["ritmo", "Ritmo"],
    ["tv", "Mapa e TV"],
    ["travas", "Travas"],
    ["hacks", "Hacks"],
    ["celular", "Celular"],
    ["handouts", "Handouts e mapas"],
    ["maldicao", "Maldição"],
    ["referencia", "Referência"],
    ["notas", "Notas e registro"]
  ];
  const STATUS = [["ativo", "Ativo"], ["inconsciente", "Desacordado"], ["morto", "Morto"], ["escapou", "Escapou"]];

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const roll = (sides) => 1 + Math.floor(Math.random() * sides);
  const charDef = (id) => D.characters.find((c) => c.id === id);
  const charView = (def) => Mesa.view(def, S.players);
  const playableDefs = () => D.characters.filter((def) => Mesa.role(def, S.players) === "playable");
  const presentDefs = () => D.characters.filter((def) => Mesa.role(def, S.players) !== "absent");
  const activeLocks = () => D.locks.filter((l) => !l.minPlayers || S.players >= l.minPlayers);
  const lockDef = (id) => D.locks.find((l) => l.id === id);

  function freshState(players = Mesa.DEFAULT_PLAYERS) {
    const chars = {};
    D.characters.forEach((c) => {
      chars[c.id] = {
        pv: c.pvStart, pd: c.pdMax,
        status: Mesa.initialStatus(c, players),
        skipRound: null, damagedOther: false,
        pvTests: 0, pdTests: 0, pvPending: false, pdPending: false
      };
    });
    const locks = {};
    D.locks.forEach((l) => {
      locks[l.id] = { code: [], reveal: false, tries: 0, status: "fechada", guess: "", feedback: null, breakAcc: 0, ra: "" };
    });
    return {
      players, round: 1, curseStart: null, idolBroken: false, curseApplied: {},
      chars, steps: {}, breakers: { porao: true, segredo: false }, locks,
      door: { input: "", errors: 0, lockedUntil: null, open: false, message: "", opensAt: null },
      gustavo: Ritmo.fresh(), clock: { startedAt: null, elapsed: 0 }, hintsShown: {},
      hack: { target: "painel", band: "10", attempts: { painel: 0, computador: 0 }, solved: { painel: false, computador: false }, last: null },
      social: { result: "", marks: {} },
      shown: {}, notes: "", log: [], tab: "caminho",
      tv: { map: "m01", style: "corpo", size: 1, positions: JSON.parse(JSON.stringify(D.tvStart)), show: null },
      dice: { count: 1, sides: 6, out: "", attr: 6, skill: 6, test: "" },
      volume: 0.6
    };
  }

  function alignChars(chars, players) {
    const out = { ...chars };
    D.characters.forEach((def) => {
      const role = Mesa.role(def, players);
      const status = out[def.id].status;
      if (role !== "playable") out[def.id] = { ...out[def.id], status: Mesa.initialStatus(def, players) };
      else if (status === "ausente") out[def.id] = { ...out[def.id], status: Mesa.initialStatus(def, players) };
    });
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const players = Mesa.normalizePlayers(saved.players ?? (saved.chars?.edgar?.status === "morto" ? 3 : undefined));
        const base = freshState(players);
        const tv = { ...base.tv, ...(saved.tv || {}) };
        tv.positions = { ...base.tv.positions, ...((saved.tv && saved.tv.positions) || {}) };
        const chars = alignChars({ ...base.chars, ...(saved.chars || {}) }, players);
        return { ...base, ...saved, players, chars, tv, dice: { ...base.dice, ...(saved.dice || {}) } };
      }
    } catch (err) {
      console.warn("Estado salvo ilegível, começando do zero.", err);
    }
    return freshState();
  }

  const SERVER_ORIGIN = "http://localhost:8765";
  const IMPORT_PREFIX = "#importar=";

  function stateJson(state) {
    const { savedAt, ...rest } = state;
    return JSON.stringify(rest);
  }

  const SAFE_CHARS = { "<": "‹", ">": "›", "\"": "”", "'": "’", "`": "‘" };

  // The import hash can come from any link, so every string is defanged
  // before it reaches templates that interpolate state.
  function defang(value, depth = 0) {
    if (depth > 12) return null;
    if (typeof value === "string") return value.replace(/[<>"'`]/g, (c) => SAFE_CHARS[c]);
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "boolean" || value === null) return value;
    if (Array.isArray(value)) return value.map((v) => defang(v, depth + 1));
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [defang(k, depth + 1), defang(v, depth + 1)]));
    return null;
  }

  function importFromHash() {
    if (!location.protocol.startsWith("http") || !location.hash.startsWith(IMPORT_PREFIX)) return;
    try {
      const incoming = defang(JSON.parse(decodeURIComponent(location.hash.slice(IMPORT_PREFIX.length))));
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("estado inválido");
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!current || (incoming.savedAt || 0) > (current.savedAt || 0)) localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
    } catch (err) {
      console.warn("Não foi possível trazer o estado do painel aberto pelo arquivo.", err);
    }
    history.replaceState(null, "", location.pathname);
  }

  importFromHash();
  let S = load();
  let lastSavedJson = stateJson(S);
  const openDetails = new Set();
  const ritmoCtx = {
    state: () => S,
    log: (msg) => log(msg),
    beep: () => beep(),
    rumble: () => rumble(),
    roll,
    esc,
    curseRound: () => curseRound(),
    charName: (id) => charDef(id).name,
    get characters() { return playableDefs(); },
    isOpen: (id) => openDetails.has(id)
  };
  const TV_KEY = "op2-tela";
  let tvWin = null;
  let lastHello = 0;
  let tvMsg = "";
  let tvShowTimer = null;
  let drag = null;
  let pushQueued = false;

  const SERVED = location.protocol.startsWith("http");
  let gm = null;
  let gmJson = "";
  let gmError = "";
  let serverUp = false;
  let serverWaiting = false;
  let serverMsg = "";
  const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);
  const START_BAT_HINT = "Dê dois cliques no arquivo iniciar-sessao.bat, na pasta do projeto. O servidor abre o painel numa aba nova: use aquela e feche esta.";
  let serverStopped = false;
  let syncTimer = null;
  let srvChipLast = "";
  let doorAcks = [];

  async function gmCall(body) {
    try {
      const res = await fetch("/api/gm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      gmError = "";
      return await res.json();
    } catch (err) {
      gmError = "Sem conexão com o servidor da sessão.";
      console.warn("Falha ao falar com o servidor.", err);
      return null;
    }
  }

  async function phoneSync() {
    if (serverStopped) return;
    const ack = doorAcks;
    doorAcks = [];
    const next = await gmCall({ action: "sync", door: { ...S.door, powered: S.breakers.porao, opensIn: Ritmo.roundsLeft(S) }, ack });
    updateSrvChip();
    if (!next) {
      updatePhoneSection(true);
      return;
    }
    let changed = false;
    next.doorQueue.forEach((item) => {
      if (ack.includes(item.id)) return;
      S.door.input = item.code;
      log(`TRANCATRON (celular): tentaram ${item.code}.`);
      ACTIONS["door-try"]();
      doorAcks.push(item.id);
      changed = true;
    });
    if (changed) render();
    applyGm(next);
  }

  function applyGm(next) {
    gm = next;
    const json = JSON.stringify({ ...next, doorQueue: [] });
    if (json === gmJson) return;
    gmJson = json;
    updatePhoneSection();
  }

  async function phoneAction(action, value) {
    const next = await gmCall({ action, value });
    if (next) applyGm(next);
    else updatePhoneSection(true);
  }

  function qrDataUrl(text, cell) {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cell, 4);
  }

  function probeServer() {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(false), 1500);
      img.onload = () => { clearTimeout(timer); resolve(true); };
      img.onerror = () => { clearTimeout(timer); resolve(false); };
      img.src = `${SERVER_ORIGIN}/assets/fichas-mapa/alan.png?t=${Date.now()}`;
    });
  }

  function refreshServerUi() {
    updateSrvChip();
    updatePhoneSection(true);
  }

  async function watchServer() {
    if (SERVED || serverWaiting) return;
    const up = await probeServer();
    if (up === serverUp) return;
    serverUp = up;
    refreshServerUi();
  }

  function goServed() {
    save();
    location.href = `${SERVER_ORIGIN}/index.html${IMPORT_PREFIX}${encodeURIComponent(JSON.stringify(S))}`;
  }

  function resumeSync() {
    serverStopped = false;
    clearInterval(syncTimer);
    phoneSync();
    syncTimer = setInterval(phoneSync, 1000);
  }

  async function startServer() {
    serverWaiting = true;
    serverMsg = "";
    refreshServerUi();
    if (IS_MAC) location.href = "op2painel://iniciar";
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await probeServer()) {
        serverWaiting = false;
        if (SERVED) {
          resumeSync();
          refreshServerUi();
        } else goServed();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    serverWaiting = false;
    serverMsg = IS_MAC ? "O servidor não respondeu. Se o Chrome perguntou se podia abrir o app Sessão OP2, clique em Abrir e tente de novo. Se não perguntou nada, dê dois cliques em iniciar-sessao.command, na pasta do projeto." : `O servidor não respondeu. ${START_BAT_HINT}`;
    refreshServerUi();
  }

  async function stopServer() {
    if (!confirm("Desligar o servidor? O celular dos jogadores para de funcionar até você ligar de novo.")) return;
    clearInterval(syncTimer);
    serverStopped = true;
    await gmCall({ action: "shutdown" });
    gm = null;
    gmJson = "";
    gmError = "Servidor desligado.";
    refreshServerUi();
  }

  function srvChipHtml() {
    if (serverWaiting) return `<div class="chip" id="srv-chip"><span>Servidor</span><b>ligando…</b></div>`;
    if (SERVED && !serverStopped && !gmError) return `<button class="chip srv-chip ok" id="srv-chip" data-act="tab" data-id="celular"><span>Servidor</span><b>ligado</b></button>`;
    if (!SERVED && serverUp) return `<button class="chip srv-chip ok" id="srv-chip" data-act="server-go"><span>Servidor ligado</span><b>Abrir painel conectado</b></button>`;
    return `<button class="chip srv-chip" id="srv-chip" data-act="server-start"><span>Servidor desligado</span><b>Ligar</b></button>`;
  }

  function updateSrvChip() {
    const chip = $("#srv-chip");
    const html = srvChipHtml();
    if (!chip || html === srvChipLast) return;
    srvChipLast = html;
    chip.outerHTML = html;
  }

  function serverStartHtml() {
    if (serverWaiting) return IS_MAC ? `<p class="muted">Ligando o servidor… Se o Chrome perguntar se pode abrir o app <b>Sessão OP2</b>, clique em Abrir.</p>` : `<p class="muted">Esperando o servidor… ${esc(START_BAT_HINT)}</p>`;
    if (!SERVED && serverUp) return `<div class="lock-row"><button class="primary" data-act="server-go">Abrir painel conectado</button></div><p class="muted">O servidor já está ligado. O painel reabre pelo servidor com tudo o que já foi marcado aqui.</p>`;
    return `<div class="lock-row"><button class="primary" data-act="server-start">Ligar servidor do celular</button></div>${serverMsg ? `<p class="warn-text">${esc(serverMsg)}</p>` : ""}`;
  }

  function offlineSectionInner() {
    return `<h2>Celular do Gustavo no celular dos jogadores</h2>
      <p class="muted">Para o celular dos jogadores funcionar, o painel precisa do servidor da sessão. O botão liga o servidor e reabre o painel por ele, com tudo o que já foi marcado aqui (rodada, maldição, PV, posições na TV).</p>
      ${serverStartHtml()}`;
  }

  function phoneSectionHtml() {
    return `<section class="card" id="phone-section">${SERVED ? phoneSectionInner() : offlineSectionInner()}</section>`;
  }

  function phoneSectionInner() {
    if (!gm) return `<h2>Celular do Gustavo no celular dos jogadores</h2><p class="muted">${esc(gmError || "Conectando ao servidor…")}</p>${gmError ? serverStartHtml() : ""}`;
    const p = gm.state;
    const allowed = gm.allowedErrors;
    const intuitionText = p.intuition === null ? "sem teste" : p.intuition < 7 ? `${p.intuition} (falhou)` : `${p.intuition} (pode errar ${allowed}x)`;
    const status = !p.enabled ? "desligado" : p.unlocked ? `desbloqueado (${p.unlockedBy})` : p.lockout ? "bloqueado: espera nova tentativa" : "na tela de bloqueio";
    return `
      <h2>Celular do Gustavo no celular dos jogadores <span class="tag ${p.unlocked ? "aberta" : ""}">${esc(status)}</span></h2>
      ${gmError ? `<p class="warn-text">${esc(gmError)}</p>` : ""}
      <div class="phone-grid">
        <div>
          <div class="lock-row">
            <button class="${p.enabled ? "on" : "primary"}" data-act="phone" data-phone="enable" data-value="${p.enabled ? "0" : "1"}">${p.enabled ? "Desligar celular" : "Ligar celular (acharam o celular)"}</button>
          </div>
          <p class="muted">Quem pegar o celular escaneia o QR. Só essa pessoa deve abrir; os outros podem olhar junto.${p.enabled ? "" : " Enquanto estiver desligado, a página do jogador mostra \"Celular desligado\" e acende sozinha quando você clicar em Ligar."}</p>
          <div class="lock-row"><input class="phone-url" readonly value="${esc(gm.phoneUrl)}"><button data-act="phone-copy">Copiar link</button><button data-act="phone-qr-big">QR em tela cheia</button><button data-act="phone-qr-tv">QR na TV</button></div>
          <h3>Perguntas de segurança</h3>
          <p class="muted">Marque as que vão aparecer no celular; precisam acertar todas as marcadas. Nome completo e aniversário só estão no RG, dentro do armário do Ídolo.</p>
          <div class="q-list">${gm.questions.map((q, i) => `
            <label class="q-item ${p.answered.includes(i) ? "ok" : ""}"><input type="checkbox" data-input="phone-q" data-id="${i}" ${p.questions.includes(i) ? "checked" : ""}>
              <span>${esc(q.label)}${p.answered.includes(i) ? " ✓" : ""}</span><span class="spoiler" tabindex="0">${esc(D.social.questions[i].a)}</span></label>`).join("")}</div>
          <h3>Teste de Intuição</h3>
          <div class="lock-row">
            <input class="ra" type="number" min="1" max="40" placeholder="resultado" data-input="phone-intuition" value="${esc(phoneIntuitionDraft)}">
            <button data-act="phone-intuition">Registrar</button>
            <span class="tag">${esc(intuitionText)}</span>
            <span class="tag">Erros: ${p.errors}</span>
          </div>
          <div class="lock-row">
            <button data-act="phone" data-phone="release">Liberar nova tentativa (próxima rodada)</button>
          </div>
          <h3>Extras</h3>
          <div class="lock-row">
            <button class="${p.hint ? "on" : ""}" data-act="phone" data-phone="hint" data-value="${p.hint ? "0" : "1"}">${p.hint ? "Lembrete \"Prata = 25\" visível" : "Mostrar lembrete \"Prata = 25\" (Tecnologia DT 4)"}</button>
            <button class="${p.acceptWeddingPassword ? "on" : ""}" data-act="phone" data-phone="wedding-password" data-value="${p.acceptWeddingPassword ? "0" : "1"}">${p.acceptWeddingPassword ? "Data de casamento aceita como senha (atalho ligado)" : "Aceitar data de casamento como senha (atalho, desligado)"}</button>
          </div>
          <div class="lock-row">
            <button class="${p.fallback ? "on danger" : ""}" data-act="phone" data-phone="fallback" data-value="${p.fallback ? "0" : "1"}">${p.fallback ? "Plano B ligado (desenho na tela)" : "Liberar plano B: desenho com marcas de dedo"}</button>
            ${p.fallback ? `<button class="${p.fallbackClarity === 2 ? "on" : ""}" data-act="phone" data-phone="clarity" data-value="${p.fallbackClarity === 2 ? "1" : "2"}">Marcas ${p.fallbackClarity === 2 ? "nítidas (mostra o início)" : "fracas"}</button>` : ""}
          </div>
          <div class="lock-row">
            <button data-act="phone" data-phone="unlock">Desbloquear na mão</button>
            <button class="ghost" data-act="phone" data-phone="relock">Bloquear de novo</button>
            <button class="ghost" data-act="phone-reset">Zerar celular</button>
            <button class="ghost" data-act="server-stop">Desligar servidor</button>
          </div>
          <p class="muted">Desbloqueado, o celular mostra o código <b>${esc(gm.twoFactor)}</b> para o e-mail do computador, as conversas (05A, 05B, 05C) e o app TRANCATRON, que usa o teclado da porta deste painel. ${p.flashlight ? "<b>A lanterna do celular está ligada.</b>" : ""}</p>
        </div>
        <div>
          <img class="phone-qr" src="${qrDataUrl(gm.phoneUrl, 5)}" alt="QR do celular">
          <h3>Ao vivo</h3>
          <ul class="log phone-log">${p.events.slice(0, 14).map((e) => `<li><span>${new Date(e.ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>${esc(e.text)}</li>`).join("") || `<li class="muted">Nada ainda.</li>`}</ul>
        </div>
      </div>`;
  }

  let phoneIntuitionDraft = "";

  function updatePhoneSection(force) {
    const box = $("#phone-section");
    if (!box || (!force && drag)) return;
    const active = document.activeElement;
    const focusKey = active && active.dataset && active.dataset.input ? active.dataset.input : null;
    box.innerHTML = SERVED ? phoneSectionInner() : offlineSectionInner();
    if (focusKey) {
      const again = box.querySelector(`[data-input="${focusKey}"]`);
      if (again) again.focus();
    }
  }

  function tvConnected() {
    return Date.now() - lastHello < 5000;
  }

  function tvState() {
    return {
      type: "op2-state",
      ts: Date.now(),
      map: S.tv.map,
      style: S.tv.style,
      size: S.tv.size,
      cursed: S.curseStart !== null,
      show: S.tv.show,
      doorCountdown: Ritmo.roundsLeft(S),
      doorPowered: Ritmo.doorPowered(S),
      tokens: [
        ...presentDefs().map((c) => ({ id: c.id, name: charView(c).tvName, status: S.chars[c.id].status, ...S.tv.positions[c.id] })),
        ...Ritmo.tvTokens(S)
      ]
    };
  }

  function pushTv() {
    const payload = tvState();
    try {
      localStorage.setItem(TV_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Não foi possível salvar o estado da TV.", err);
    }
    if (tvWin && !tvWin.closed) tvWin.postMessage(payload, "*");
  }

  function queuePush() {
    if (pushQueued) return;
    pushQueued = true;
    requestAnimationFrame(() => {
      pushQueued = false;
      pushTv();
    });
  }

  function save() {
    const json = stateJson(S);
    if (json === lastSavedJson) return;
    lastSavedJson = json;
    S.savedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch (err) {
      console.warn("Não foi possível salvar o estado.", err);
    }
  }

  function log(msg) {
    S.log = [{ r: S.round, msg }, ...S.log].slice(0, 300);
  }

  function curseRound() {
    return S.curseStart === null ? null : S.round - S.curseStart;
  }

  function curseRowFor(c) {
    if (c === null || c < 0) return null;
    if (c >= 14) return D.curse.find((r) => r.round === 14);
    return D.curse.find((r) => r.round === c) || null;
  }

  function aliveCount() {
    return playableDefs().filter((def) => S.chars[def.id].status !== "morto").length;
  }

  function testName(stat) {
    return stat === "pv" ? "Vigor" : "Disciplina";
  }

  function changeStat(id, stat, delta) {
    const c = S.chars[id];
    const def = charDef(id);
    const max = stat === "pv" ? def.pvMax : def.pdMax;
    const after = Math.max(0, Math.min(max, c[stat] + delta));
    const testsKey = stat + "Tests";
    const pendingKey = stat + "Pending";
    const before = c[stat];
    c[stat] = after;
    if (stat === "pd" && after < before) suggestPdLine(id, c, after, max);
    if (stat === "pd" && after > before) c.pdLine = null;
    if (delta < 0 && after === 0) {
      c[testsKey] += 1;
      c[pendingKey] = true;
      log(`${def.name} em 0 ${stat.toUpperCase()}: ${testName(stat)} DT ${7 + 3 * (c[testsKey] - 1)}.`);
    }
    if (after > 0) {
      c[testsKey] = 0;
      c[pendingKey] = false;
    }
  }

  function suggestPdLine(id, c, after, max) {
    const tier = FalasPD.tierFor(after, max);
    const uses = c.pdLineUses || {};
    const pick = FalasPD.pickLine(id, after, max, uses[tier]);
    if (!pick) return;
    c.pdLineUses = { ...uses, [tier]: (uses[tier] || 0) + 1 };
    c.pdLine = pick.text;
  }

  function nextRound() {
    S.round += 1;
    Object.values(S.chars).forEach((c) => { c.damagedOther = false; });
    if (S.door.lockedUntil !== null && S.round >= S.door.lockedUntil) {
      S.door.lockedUntil = null;
      S.door.errors = 0;
      S.door.message = "Teclado liberado de novo.";
      log("Teclado da porta liberado.");
    }
    Ritmo.onNextRound(S, ritmoCtx);
    if (S.round === 2) {
      playableDefs().filter((def) => def.startStatus === "inconsciente" && S.chars[def.id].status === "inconsciente").forEach((def) => {
        S.chars[def.id].status = "ativo";
        log(`${def.name} acorda (um passo a menos em testes físicos nesta rodada).`);
      });
    }
    log(`Começa a rodada ${S.round}.`);
  }

  function activateCurse() {
    if (S.curseStart !== null) return;
    S.curseStart = S.round;
    log("Maldição ativada. Rodada 0 da maldição.");
    crossfadeTo("idolo");
  }

  function applyCurseLoss() {
    const row = curseRowFor(curseRound());
    if (!row || !row.loss || S.curseApplied[row.round]) return;
    const hits = [];
    playableDefs().forEach((def) => {
      const c = S.chars[def.id];
      if (c.status === "morto" || c.status === "escapou") return;
      let pv = S.idolBroken ? 1 : 0;
      let pd = S.idolBroken ? 1 : 0;
      if (!c.damagedOther) {
        pv += row.loss.pv;
        pd += row.loss.pd;
      }
      if (pv) changeStat(def.id, "pv", -pv);
      if (pd) changeStat(def.id, "pd", -pd);
      if (pv || pd) hits.push(`${def.name} ${[pv && `-${pv} PV`, pd && `-${pd} PD`].filter(Boolean).join(" ")}`);
    });
    S.curseApplied[row.round] = true;
    log(`Maldição, rodada ${row.round}: ${hits.join("; ") || "ninguém perdeu nada"}.`);
  }

  const music = {
    porao: new Audio("assets/musica/porao.mp3"),
    idolo: new Audio("assets/musica/idolo.mp3")
  };
  Object.values(music).forEach((a) => {
    a.loop = true;
    a.preload = "none";
    a.volume = S.volume;
    a.addEventListener("play", renderTopbar);
    a.addEventListener("pause", renderTopbar);
  });
  const fades = {};

  function fade(audio, to, ms, done) {
    clearInterval(fades[audio.src]);
    const from = audio.volume;
    const start = performance.now();
    fades[audio.src] = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t >= 1) {
        clearInterval(fades[audio.src]);
        if (done) done();
      }
    }, 50);
  }

  function crossfadeTo(id) {
    Object.entries(music).forEach(([key, audio]) => {
      if (key === id) return;
      if (!audio.paused) fade(audio, 0, 2000, () => { audio.pause(); audio.volume = S.volume; });
    });
    const target = music[id];
    target.volume = 0;
    target.play().catch((err) => console.warn("Áudio bloqueado pelo navegador.", err));
    fade(target, S.volume, 2000);
  }

  function toggleMusic(id) {
    const audio = music[id];
    if (audio.paused) crossfadeTo(id);
    else fade(audio, 0, 800, () => { audio.pause(); audio.volume = S.volume; });
  }

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function rumble() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const seconds = 2.2;
    const noise = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * seconds), audioCtx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = audioCtx.createBufferSource();
    source.buffer = noise;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + seconds);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(t);
    source.stop(t + seconds);
    const low = audioCtx.createOscillator();
    const lowGain = audioCtx.createGain();
    low.type = "sawtooth";
    low.frequency.setValueAtTime(70, t);
    low.frequency.exponentialRampToValueAtTime(38, t + seconds);
    lowGain.gain.setValueAtTime(0.0001, t);
    lowGain.gain.exponentialRampToValueAtTime(0.25, t + 0.1);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    low.connect(lowGain).connect(audioCtx.destination);
    low.start(t);
    low.stop(t + seconds);
  }

  function beep() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    [0, 0.35].forEach((offset) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = 196;
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.32);
    });
  }

  const overlay = { timer: null, endAt: 0 };

  function showOverlay({ src, caption = "", seconds = 0 }) {
    const el = $("#overlay");
    const img = $("#ov-img");
    const timer = $("#ov-timer");
    clearInterval(overlay.timer);
    img.src = src;
    img.hidden = false;
    $("#ov-stage").classList.remove("zoom");
    $("#ov-caption").textContent = caption;
    $("#ov-done").hidden = true;
    timer.hidden = !seconds;
    timer.classList.remove("warn");
    el.hidden = false;
    document.body.classList.add("ov-open");
    if (!seconds) return;
    overlay.endAt = performance.now() + seconds * 1000;
    const tick = () => {
      const left = Math.max(0, overlay.endAt - performance.now());
      timer.textContent = String(Math.ceil(left / 1000));
      timer.classList.toggle("warn", left <= 3000);
      if (left <= 0) {
        clearInterval(overlay.timer);
        img.hidden = true;
        timer.hidden = true;
        $("#ov-done").hidden = false;
        beep();
      }
    };
    tick();
    overlay.timer = setInterval(tick, 100);
  }

  function hideOverlay() {
    clearInterval(overlay.timer);
    $("#overlay").hidden = true;
    $("#ov-img").removeAttribute("src");
    document.body.classList.remove("ov-open");
  }

  function thumbFor(file) {
    const [dir, name] = file.split("/");
    const stem = name.replace(/\.[^.]+$/, "");
    return `assets/thumbs/${dir}-${stem}.${dir === "tokens" ? "png" : "jpg"}`;
  }

  function hackPlan() {
    const h = S.hack;
    const def = D.hack[h.target];
    const band = def.bands.find((b) => b.id === h.band);
    const attempt = h.attempts[h.target] + 1;
    if (attempt >= 3) return { def, band, attempt, auto: true };
    const idx = attempt - 1;
    const image = h.target === "painel" ? band.images[idx] : def.images[idx];
    const answer = h.target === "painel" ? band.answers[idx] : def.answers[idx];
    return { def, band, attempt, image, answer, seconds: band.seconds, auto: false };
  }

  function parseGuess(text) {
    return (String(text).match(/\d/g) || []).map(Number);
  }

  function checkLock(id) {
    const def = lockDef(id);
    const st = S.locks[id];
    if (!st.code.length || st.status !== "fechada") return;
    const guess = parseGuess(st.guess);
    if (guess.length !== def.dice || guess.some((g) => g < 1 || g > def.sides)) {
      st.feedback = { error: `Digite ${def.dice} números de 1 a ${def.sides}.` };
      return;
    }
    st.tries += 1;
    const marks = guess.map((g, i) => (g === st.code[i] ? "exato" : g < st.code[i] ? "baixo" : "alto"));
    st.feedback = { guess, marks };
    if (marks.every((m) => m === "exato")) {
      openLock(id, "senha");
    } else if (st.tries >= def.maxTries) {
      st.status = "estragada";
      log(`${def.name}: fechadura estragou. Só abre na força ou com a chave.`);
    }
  }

  function openLock(id, how) {
    const def = lockDef(id);
    const st = S.locks[id];
    st.status = "aberta";
    st.openedBy = how;
    log(`${def.name} aberta (${how}).`);
    if (id === "armario") {
      if (how === "força") {
        S.idolBroken = true;
        log("O Ídolo quebrou. Quem arrombou faz Vigor DT 7.");
      }
      activateCurse();
    }
  }

  function socialSummary() {
    const result = Number(S.social.result);
    const hasResult = S.social.result !== "" && !Number.isNaN(result);
    const allowed = hasResult && result >= 7 ? Math.floor((result - 7) / 3) : null;
    const values = Object.values(S.social.marks);
    const right = values.filter((v) => v === "certo").length;
    const wrong = values.filter((v) => v === "errado").length;
    let status = "";
    if (hasResult && result < 7) status = "Falhou no teste de Intuição. Tenta de novo na próxima rodada.";
    else if (right >= D.social.needed) status = "Celular desbloqueado.";
    else if (allowed !== null && wrong > allowed) status = "Errou mais do que podia. Tenta de novo na próxima rodada (limpe as marcações).";
    return { hasResult, result, allowed, right, wrong, status };
  }

  function reminders() {
    const list = [];
    (Mesa.pick(D.roundReminders[S.round], S.players) || []).forEach((t) => list.push({ kind: "info", text: t }));
    playableDefs().forEach((def) => {
      const c = S.chars[def.id];
      if (c.skipRound === S.round) list.push({ kind: "warn", text: `${def.name} não age nesta rodada.` });
      if (c.pvPending) list.push({ kind: "danger", text: `${def.name} está com 0 PV: Vigor DT ${7 + 3 * (c.pvTests - 1)}. Falhou, morre.` });
      if (c.pdPending) list.push({ kind: "danger", text: `${def.name} está com 0 PD: Disciplina DT ${7 + 3 * (c.pdTests - 1)}. Falhou, morre.` });
    });
    if (!S.breakers.porao) list.push({ kind: "warn", text: "Disjuntor \"Porão\" desligado: a estante e a porta de saída não funcionam." });
    if (S.door.lockedUntil !== null) list.push({ kind: "warn", text: `Teclado da porta bloqueado até a rodada ${S.door.lockedUntil}.` });
    list.push(...Ritmo.reminders(S, ritmoCtx));
    const c = curseRound();
    if (c !== null) {
      const row = curseRowFor(c);
      if (row) list.push({ kind: "curse", text: `Maldição, rodada ${c}: ${row.text}${row.loss && !S.curseApplied[row.round] ? " Marque quem feriu outro; ao clicar + no fim da rodada, as perdas são aplicadas." : ""}`, loss: row.loss && !S.curseApplied[row.round] });
      const next = curseRowFor(c + 1);
      if (next && c + 1 <= 14) list.push({ kind: "info", text: `Na próxima rodada (maldição ${c + 1}): ${next.text}` });
      if (S.idolBroken && [4, 7, 10].includes(c)) list.push({ kind: "curse", text: "Ídolo quebrado: nesta rodada todos perdem +1 PV e +1 PD (o botão já inclui)." });
      const alive = aliveCount();
      list.push({ kind: alive <= D.survivorsNeeded ? "info" : "curse", text: alive <= D.survivorsNeeded ? `Restam ${alive} vivos: a dívida está paga, a maldição acaba.` : `Vivos: ${alive}. A maldição só acaba quando restarem ${D.survivorsNeeded}.` });
    }
    return list;
  }

  function renderTopbar() {
    const c = curseRound();
    const opening = Ritmo.roundsLeft(S);
    const door = S.door.open ? "aberta" : opening !== null ? `destravando (${opening})` : S.door.lockedUntil !== null ? `bloqueada até R${S.door.lockedUntil}` : "fechada";
    const musicBtn = (id, label) => `<button class="music ${music[id].paused ? "" : "on"}" data-act="music" data-id="${id}">${music[id].paused ? "▶" : "❚❚"} ${label}</button>`;
    $("#topbar").innerHTML = `
      <div class="brand"><span class="eyebrow">Ordem Paranormal II · Playtest</span><strong>O Ídolo de Pedra · Ato I</strong></div>
      <div class="round">
        <button class="round-btn" data-act="round-prev" title="Voltar uma rodada">−</button>
        <div class="round-num"><span>Rodada</span><b>${S.round}</b></div>
        <button class="round-btn primary" data-act="round-next" title="Próxima rodada">+</button>
      </div>
      <div class="curse-chip ${c === null ? "" : "active"}">
        ${c === null ? `<button class="danger-btn" data-act="curse-on">Ativar maldição</button>` : `<span>Maldição</span><b>rodada ${c}</b>`}
      </div>
      <div class="chip ${S.door.open ? "ok" : ""} ${opening !== null ? "warn" : ""}"><span>Porta</span><b>${door}</b></div>
      ${Ritmo.clockChipHtml(S)}
      <button class="chip tv-chip" id="tv-chip" data-act="tab" data-id="tv">${tvChipHtml()}</button>
      ${(srvChipLast = srvChipHtml())}
      <div class="music-box">
        ${musicBtn("porao", "O Porão")}
        ${musicBtn("idolo", "O Ídolo")}
        <input type="range" min="0" max="1" step="0.05" value="${S.volume}" data-input="volume" title="Volume">
      </div>
      <label class="players-box" title="Muda quem joga: com 3, o Edgar já está morto no altar; com 5, entra a Kênia.">Jogadores
        <select data-input="players">${Mesa.PLAYER_OPTIONS.map((n) => `<option value="${n}" ${S.players === n ? "selected" : ""}>${n}</option>`).join("")}</select>
      </label>
      <button class="ghost" data-act="reset">Nova sessão</button>`;
  }

  function renderReminders() {
    const items = reminders();
    $("#reminders").innerHTML = items.length
      ? items.map((r) => `<div class="rem ${r.kind}"><span>${esc(r.text)}</span>${r.loss ? `<button class="danger-btn small" data-act="curse-apply">Aplicar perdas</button>` : ""}</div>`).join("")
      : `<div class="rem muted"><span>Nada especial nesta rodada.</span></div>`;
  }

  function statRow(def, c, stat) {
    const max = stat === "pv" ? def.pvMax : def.pdMax;
    const pct = Math.round((c[stat] / max) * 100);
    const pending = c[stat + "Pending"];
    return `
      <div class="stat ${stat}">
        <span class="stat-label">${stat.toUpperCase()}</span>
        <button data-act="stat" data-id="${def.id}" data-stat="${stat}" data-delta="-1">−</button>
        <div class="bar"><i style="width:${pct}%"></i><b>${c[stat]} / ${max}</b></div>
        <button data-act="stat" data-id="${def.id}" data-stat="${stat}" data-delta="1">+</button>
      </div>
      ${pending ? `<div class="pending">0 ${stat.toUpperCase()}: ${testName(stat)} DT ${7 + 3 * (c[stat + "Tests"] - 1)}
        <button data-act="test-pass" data-id="${def.id}" data-stat="${stat}">Passou</button>
        <button class="danger-btn small" data-act="test-fail" data-id="${def.id}" data-stat="${stat}">Falhou</button></div>` : ""}
      ${stat === "pd" && c.pdLine ? `<div class="pd-line"><span><em>Para narrar:</em> ${esc(c.pdLine)}</span><button class="small" data-act="pd-line-hide" data-id="${def.id}" title="Esconder">ok</button></div>` : ""}`;
  }

  function renderChars() {
    const cursed = curseRound() !== null;
    $("#chars").innerHTML = playableDefs().map(charView).map((def) => {
      const c = S.chars[def.id];
      const skip = c.skipRound === S.round ? "Não age nesta rodada" : c.skipRound === S.round + 1 ? "Não age na próxima" : "";
      return `
      <article class="char status-${c.status}">
        <header>
          <img src="${thumbFor(`tokens/${def.id}.png`)}" alt="">
          <div><h3>${esc(def.name)}</h3><small>${esc(def.profile)}</small></div>
          <select data-input="status" data-id="${def.id}">
            ${STATUS.map(([v, l]) => `<option value="${v}" ${c.status === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </header>
        ${statRow(def, c, "pv")}
        ${statRow(def, c, "pd")}
        <div class="char-actions">
          <button class="${c.skipRound === S.round + 1 ? "on" : ""}" data-act="skip" data-id="${def.id}">Perde a próxima rodada</button>
          ${cursed ? `<button class="${c.damagedOther ? "on danger" : ""}" data-act="damaged" data-id="${def.id}">Feriu outro nesta rodada</button>` : ""}
          ${skip ? `<span class="tag warn">${skip}</span>` : ""}
        </div>
        <div class="skills">
          ${Object.entries(def.skills).map(([k, v]) => `<span title="${esc(D.skillNames[k])}"><em>${k}</em>${v}</span>`).join("")}
          <span title="Crime: tentativas de destrancar por rodada"><em>Crime</em>${def.crime} (${def.crimeTries})</span>
        </div>
        <details data-details="${def.id}" ${openDetails.has(def.id) ? "open" : ""}>
          <summary>Início e segredo</summary>
          <p class="start">${esc(def.start)}</p>
          <p class="secret" tabindex="0"><em>Segredo (passe o mouse):</em> ${esc(def.secret)}</p>
        </details>
      </article>`;
    }).join("");
  }

  function renderTabs() {
    $("#tabs").innerHTML = TABS.map(([id, label]) => `<button class="${S.tab === id ? "on" : ""}" data-act="tab" data-id="${id}">${label}</button>`).join("");
  }

  function tabCaminho() {
    const b = S.breakers;
    const done = D.steps.filter((s) => S.steps[s.id]).length;
    return `
      <section class="card">
        <h2>Painel elétrico</h2>
        <div class="breakers">
          <button class="breaker ${b.porao ? "on" : ""}" data-act="breaker" data-id="porao"><b>Porão</b><span>${b.porao ? "Ligado" : "Desligado"}</span><small>Estante e porta de saída só funcionam com ele ligado.</small></button>
          <button class="breaker ${b.segredo ? "on" : ""}" data-act="breaker" data-id="segredo"><b>Segredo</b><span>${b.segredo ? "Ligado" : "Desligado"}</span><small>Luz da sala secreta e computador.</small></button>
        </div>
      </section>
      <section class="card">
        <h2>Caminho até a saída <small>${done} de ${D.steps.length}</small></h2>
        <ol class="steps">
          ${D.steps.map((s) => `<li class="${S.steps[s.id] ? "done" : ""}"><label><input type="checkbox" data-input="step" data-id="${s.id}" ${S.steps[s.id] ? "checked" : ""}><b>${esc(s.title)}</b></label><p>${esc(Mesa.pick(s.text, S.players))}</p></li>`).join("")}
        </ol>
      </section>
      <section class="card door">
        <h2>Teclado da porta de saída</h2>
        <p class="muted">Digite o que os jogadores disserem. Três erros bloqueiam o teclado por 2 rodadas. Precisa do disjuntor "Porão" ligado.</p>
        <div class="door-row">
          <input class="door-input" maxlength="6" inputmode="numeric" placeholder="DDMMAA" value="${esc(S.door.input)}" data-input="door" ${S.door.open ? "disabled" : ""}>
          <button class="primary" data-act="door-try" ${S.door.open ? "disabled" : ""}>Tentar</button>
          <span class="tag">Erros: ${S.door.errors} de 3</span>
        </div>
        ${S.door.message ? `<p class="door-msg ${S.door.open ? "ok" : ""}">${esc(S.door.message)}</p>` : ""}
        <p class="muted">Senha: <span class="spoiler" tabindex="0">${D.doorCode}</span></p>
      </section>`;
  }

  function tabTravas() {
    const cards = activeLocks().map((def) => {
      const st = S.locks[def.id];
      const statusLabel = { fechada: "Fechada", aberta: `Aberta (${st.openedBy || ""})`, estragada: "Fechadura estragada" }[st.status];
      const fb = st.feedback;
      const feedback = fb ? fb.error ? `<p class="door-msg">${esc(fb.error)}</p>` : `<div class="marks">${fb.marks.map((m, i) => `<span class="mark ${m}"><small>${i + 1}º · ${fb.guess[i]}</small>${m === "baixo" ? "baixo<br><em>o número é maior</em>" : m === "alto" ? "alto<br><em>o número é menor</em>" : "exato"}</span>`).join("")}</div>` : "";
      const lockPart = def.dice ? `
          <div class="lock-row">
            <span class="tag">${def.dice}d${def.sides}</span>
            <span class="tag">Tentativas: ${st.tries} de ${def.maxTries}</span>
            <button data-act="lock-gen" data-id="${def.id}">${st.code.length ? "Gerar outra senha" : "Gerar senha secreta"}</button>
            ${st.code.length ? `<button class="ghost" data-act="lock-reveal" data-id="${def.id}">${st.reveal ? st.code.join(" ") : "Mostrar senha"}</button>` : ""}
          </div>
          ${st.code.length && st.status === "fechada" ? `
          <div class="lock-row">
            <input class="guess" placeholder="ex.: ${Array.from({ length: def.dice }, (_, i) => (i % def.sides) + 1).join(" ")}" value="${esc(st.guess)}" data-input="guess" data-id="${def.id}">
            <button class="primary" data-act="lock-check" data-id="${def.id}">Conferir palpite</button>
          </div>` : ""}
          ${feedback}` : "";
      return `
        <section class="card lock status-${st.status}">
          <h2>${esc(def.name)} <span class="tag ${st.status}">${statusLabel}</span></h2>
          ${def.warn ? `<p class="warn-text">${esc(def.warn)}</p>` : ""}
          ${Mesa.pick(def.note, S.players) ? `<p class="muted">${esc(Mesa.pick(def.note, S.players))}</p>` : ""}
          ${lockPart}
          <div class="lock-row">
            <span class="tag">Arrombar: DT ${def.breakDT}, PA ${def.breakPA}</span>
            <span class="tag">Acumulado: ${st.breakAcc}</span>
            <input class="ra" type="number" min="1" max="12" placeholder="RA" value="${esc(st.ra)}" data-input="ra" data-id="${def.id}" ${st.status === "aberta" ? "disabled" : ""}>
            <button data-act="lock-break" data-id="${def.id}" ${st.status === "aberta" ? "disabled" : ""}>Somar RA</button>
            ${def.key ? `<button data-act="lock-key" data-id="${def.id}" ${st.status === "aberta" ? "disabled" : ""}>Abriu com ${esc(def.key)}</button>` : ""}
            <button class="ghost" data-act="lock-reset" data-id="${def.id}">Zerar</button>
          </div>
        </section>`;
    }).join("");
    return `
      <section class="card">
        <h2>Como funciona</h2>
        <p>Destrancar: gere a senha secreta, digite o palpite do jogador e leia o resultado de cada dado. ${esc(D.crimeTries)}</p>
        <p>Arrombar: o jogador gasta 1 PV e testa Atletismo contra a DT. Se passar, some a RA dele aqui. Faz barulho.</p>
        <p class="muted">Crime do grupo: ${playableDefs().map((d) => `${esc(d.name)} ${d.crime} (${d.crimeTries})`).join(", ")}.</p>
      </section>
      ${cards}
      <section class="card">
        <h2>Estante (Handout 06)</h2>
        <table><tr><th>Prateleira</th><th>Livro</th><th>Pôster</th></tr>
          <tr><td>2</td><td>O Gol Que Ninguém Viu</td><td>Unidos do Invisível Futebol Clube</td></tr>
          <tr><td>3</td><td>Explosivos Industriais Vol. III</td><td>Eric Tufão 3</td></tr>
          <tr><td>4</td><td>Pixel a Pixel: Como Me Tornei Uma Lenda Dos Games</td><td>Lutadores de Rua</td></tr>
          <tr><td>5</td><td>Aprenda Guitarra Sem Ter Uma Guitarra</td><td>Thunderland 2008</td></tr>
        </table>
        <p class="muted">A estante abre só uma fresta. Alguém precisa Sustentar (DT 7): passa uma pessoa por rodada; se falhar enquanto alguém passa, essa pessoa perde d4 PV.</p>
      </section>`;
  }

  function tabHacks() {
    const h = S.hack;
    const plan = hackPlan();
    const def = plan.def;
    const social = socialSummary();
    const solved = h.solved[h.target];
    return `
      <section class="card">
        <h2>Hack técnico <small>regra da casa: desafio visual</small></h2>
        <p class="muted">Quem rolou Tecnologia responde sozinho, só olhando: sem dedo, caneta ou mouse. Errou ou acabou o tempo: tenta de novo na rodada seguinte.</p>
        <div class="seg">
          ${Object.entries(D.hack).map(([id, d]) => `<button class="${h.target === id ? "on" : ""}" data-act="hack-target" data-id="${id}">${d.label}${h.solved[id] ? " ✓" : ""}</button>`).join("")}
        </div>
        <div class="seg">
          <span class="seg-label">Resultado do teste de Tecnologia</span>
          ${def.bands.map((b) => `<button class="${h.band === b.id ? "on" : ""}" data-act="hack-band" data-id="${b.id}">${b.label}</button>`).join("")}
        </div>
        ${h.last && h.last.target === h.target ? `<div class="last-shown">Imagem que os jogadores acabaram de ver: tentativa ${h.last.attempt}. Resposta certa (passe o mouse): <span class="spoiler" tabindex="0">${esc(h.last.answer)}</span></div>` : ""}
        <div class="hack-plan">
          <div>
            <p><b>Próxima: tentativa ${plan.attempt}</b> ${plan.auto ? "" : `· imagem ${plan.attempt === 1 ? "principal" : "da 2ª tentativa"} · ${plan.seconds} segundos`}</p>
            <p>Pergunte: <q>${esc(def.question)}</q></p>
            ${plan.auto ? `<p class="ok-text">Terceira tentativa: passa automaticamente.</p>` : `<p>Resposta: <span class="spoiler" tabindex="0">${esc(plan.answer)}</span></p>`}
            <div class="lock-row">
              ${plan.auto ? "" : `<button class="primary big" data-act="hack-show">Mostrar aos jogadores e iniciar cronômetro</button>`}
              <button data-act="hack-solved">${solved ? "Resolvido ✓" : "Acertou"}</button>
              <button class="ghost" data-act="hack-reset">Zerar tentativas</button>
            </div>
            ${solved ? `<p class="ok-text">${esc(def.success)}</p>` : ""}
          </div>
          ${plan.auto ? "" : `<img class="hack-thumb" src="assets/thumbs/hack-${plan.image}.jpg" alt="">`}
        </div>
      </section>
      <section class="card">
        <h2>Hack social do celular do Gustavo <small>modo falado, sem o celular dos jogadores (no celular deles, use a aba Celular)</small></h2>
        <p class="muted">Intuição DT 7. Precisa de ${D.social.needed} respostas certas. A cada 3 pontos acima da DT, pode errar uma vez. ${esc(D.social.hint)}</p>
        <div class="lock-row">
          <label>Resultado do teste <input class="ra" type="number" value="${esc(S.social.result)}" data-input="social-result"></label>
          <button data-act="social-calc">Calcular</button>
          ${social.hasResult && social.allowed !== null ? `<span class="tag">Pode errar ${social.allowed}x</span>` : ""}
          <span class="tag">Certas: ${social.right} de ${D.social.needed}</span>
          <span class="tag">Erradas: ${social.wrong}</span>
          <button class="ghost" data-act="social-reset">Limpar</button>
        </div>
        ${social.status ? `<p class="${social.right >= D.social.needed ? "ok-text" : "warn-text"}">${esc(social.status)}</p>` : ""}
        <table class="social">
          <tr><th>Pergunta</th><th>Resposta</th><th>Onde está</th><th></th></tr>
          ${D.social.questions.map((q, i) => {
            const m = S.social.marks[i];
            return `<tr class="${m || ""}"><td>${esc(q.q)}</td><td><span class="spoiler" tabindex="0">${esc(q.a)}</span></td><td class="muted">${esc(q.where)}</td>
              <td class="nowrap"><button class="${m === "certo" ? "on" : ""}" data-act="social-mark" data-id="${i}" data-val="certo">Certo</button>
              <button class="${m === "errado" ? "on danger" : ""}" data-act="social-mark" data-id="${i}" data-val="errado">Errado</button></td></tr>`;
          }).join("")}
        </table>
        <p class="muted">${esc(D.social.pacing)}</p>
      </section>`;
  }

  function tabHandouts() {
    return D.gallery.map((g) => `
      <section class="card">
        <h2>${esc(g.group)}</h2>
        <div class="gallery ${g.secret ? "secret-group" : ""}">
          ${g.items.map((it) => `
            <figure class="${S.shown[it.id] ? "shown" : ""}">
              <button class="thumb" data-act="show" data-id="${it.id}" title="Mostrar em tela cheia"><img loading="lazy" src="${thumbFor(it.file)}" alt=""></button>
              <figcaption><b>${esc(it.title)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ""}
                <div class="fig-actions"><button data-act="tv-show" data-id="${it.id}">Na TV</button>
                <label class="shown-toggle"><input type="checkbox" data-input="shown" data-id="${it.id}" ${S.shown[it.id] ? "checked" : ""}> já mostrado</label></div>
              </figcaption>
            </figure>`).join("")}
        </div>
      </section>`).join("");
  }

  function tabMaldicao() {
    const c = curseRound();
    const rows = D.curse.map((r) => {
      const current = c !== null && (c === r.round || (r.round === 14 && c >= 14));
      const applied = S.curseApplied[r.round];
      return `<tr class="${current ? "current" : ""}"><td>${r.round === 14 ? "14+" : r.round}</td><td>${esc(r.text)}</td>
        <td class="nowrap">${r.loss ? applied ? `<span class="tag">Aplicado</span>` : current ? `<button class="danger-btn small" data-act="curse-apply">Aplicar perdas</button>` : "" : ""}</td></tr>`;
    }).join("");
    return `
      <section class="card">
        <h2>A maldição ${c === null ? "<small>inativa</small>" : `<small>rodada ${c} da maldição</small>`}</h2>
        ${c === null ? `
          <p>Ativa quando o armário de metal é aberto (a página ativa sozinha quando você marca o armário como aberto na aba Travas). Leia a narração da p. 52; a música troca para "O Ídolo".</p>
          <p class="muted">Se a mesa travar, o livro autoriza ativar antes: energia vindo do armário, espasmos no freezer.</p>
          <button class="danger-btn big" data-act="curse-on">Ativar maldição agora</button>` : `
          <p>Vivos: <b>${aliveCount()}</b> (contando quem escapou). A dívida é paga quando restarem ${D.survivorsNeeded}; com ${S.players} jogadores, ${S.players - D.survivorsNeeded === 1 ? "basta 1 morte" : `são ${S.players - D.survivorsNeeded} mortes`}.</p>
          <p class="muted">Nas rodadas 4, 7 e 10, marque nos cards quem feriu outro personagem vivo nesta rodada antes de aplicar as perdas.</p>`}
        <table class="curse-table"><tr><th>Rodada</th><th>Efeito</th><th></th></tr>${rows}</table>
        <div class="lock-row">
          <button class="${S.idolBroken ? "on danger" : ""}" data-act="idol-broken">${S.idolBroken ? "Ídolo quebrado ✓" : "Marcar Ídolo quebrado"}</button>
          ${c !== null ? `<button class="ghost" data-act="curse-off">Desfazer ativação</button>` : ""}
        </div>
        <p class="muted">Ídolo quebrado: quem quebrou faz Vigor DT 7 (passou: -3 PV e -1 PD; falhou: -4 PV, -2 PD e perde a próxima rodada). Depois, nas rodadas 4, 7 e 10, todos perdem +1 PV e +1 PD.</p>
      </section>`;
  }

  function tabReferencia() {
    const d = S.dice;
    const sides = [4, 6, 8, 10, 12];
    return `
      <section class="card">
        <h2>Dados do mestre</h2>
        <div class="lock-row">
          <input class="ra" type="number" min="1" max="10" value="${d.count}" data-input="dice-count">
          ${sides.map((s) => `<button data-act="roll" data-sides="${s}">d${s}</button>`).join("")}
          <span class="dice-out">${esc(d.out)}</span>
        </div>
        <div class="lock-row">
          <span class="seg-label">Teste (atributo + perícia)</span>
          <select data-input="dice-attr">${sides.map((s) => `<option value="${s}" ${d.attr === s ? "selected" : ""}>d${s}</option>`).join("")}</select>
          <select data-input="dice-skill">${sides.map((s) => `<option value="${s}" ${d.skill === s ? "selected" : ""}>d${s}</option>`).join("")}</select>
          <button data-act="roll-test">Rolar teste</button>
          <span class="dice-out">${esc(d.test)}</span>
        </div>
      </section>
      <section class="card">
        <h2>A verdade em 30 segundos</h2>
        <ul class="spoiler-block" tabindex="0">${D.truth.map((t) => Mesa.pick(t, S.players)).filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </section>
      <section class="card">
        <h2>Armadilhas pro mestre</h2>
        <ul>${D.traps.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </section>
      <section class="card">
        <h2>Regras de bolso</h2>
        <dl class="rules">${D.rules.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <h3>Falha crítica (1d8)</h3>
        <ol>${D.critFail.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </section>
      <section class="card">
        <h2>Final</h2>
        <ul>${D.ending.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </section>`;
  }

  function tabNotas() {
    return `
      <section class="card">
        <h2>Notas</h2>
        <textarea data-input="notes" placeholder="Anotações da sessão. Salva sozinho."></textarea>
      </section>
      <section class="card">
        <h2>Registro</h2>
        <ul class="log">${S.log.map((e) => `<li><span>R${e.r}</span>${esc(e.msg)}</li>`).join("") || "<li class=\"muted\">Nada ainda.</li>"}</ul>
      </section>`;
  }

  function tvChipHtml() {
    const show = S.tv.show;
    let value = S.tv.map ? Stage.MAPS[S.tv.map].label.split(":")[0] : "Tela preta";
    if (show) {
      const left = show.seconds ? Math.max(0, Math.ceil((show.startedAt + show.seconds * 1000 - Date.now()) / 1000)) : null;
      value = `${show.label}${left !== null ? ` · ${left > 0 ? left + " s" : "tempo!"}` : ""}`;
    }
    return `<span>TV ${tvConnected() ? "conectada" : "desligada"}</span><b>${esc(value)}</b>`;
  }

  function updateTvChip() {
    const chip = $("#tv-chip");
    if (chip) {
      chip.innerHTML = tvChipHtml();
      chip.classList.toggle("ok", tvConnected());
    }
    const status = $("#tv-status");
    if (status) {
      status.textContent = tvConnected() ? "conectada" : "não conectada";
      status.classList.toggle("aberta", tvConnected());
    }
  }

  function showOnTv(show) {
    S.tv.show = { ...show, startedAt: Date.now() };
    watchTvShow();
  }

  function watchTvShow() {
    clearInterval(tvShowTimer);
    const show = S.tv.show;
    if (!show || !show.seconds) return;
    const endAt = show.startedAt + show.seconds * 1000;
    let beeped = Date.now() > endAt;
    tvShowTimer = setInterval(() => {
      const left = endAt - Date.now();
      updateTvChip();
      if (left <= 0 && !beeped) {
        beeped = true;
        beep();
      }
      if (left <= -4000) {
        clearInterval(tvShowTimer);
        if (S.tv.show && S.tv.show.startedAt === show.startedAt) {
          S.tv.show = null;
          render();
        }
      }
    }, 200);
  }

  function tabTv() {
    const tv = S.tv;
    const connected = tvConnected();
    const mapKey = tv.map || "m01";
    const sizePct = Math.round(tv.size * 100);
    return `
      <div class="tv-layout">
      <div class="tv-controls">
      <section class="card">
        <h2>Tela dos jogadores <span class="tag ${connected ? "aberta" : ""}" id="tv-status">${connected ? "conectada" : "não conectada"}</span></h2>
        <div class="lock-row">
          <button class="primary" data-act="tv-open">${connected ? "Abrir de novo" : "Abrir tela dos jogadores"}</button>
          ${tv.show ? `<button class="danger" data-act="tv-clear">Tirar a imagem da TV (${esc(tv.show.label)})</button>` : ""}
        </div>
        ${tvMsg ? `<p class="warn-text">${esc(tvMsg)}</p>` : ""}
        <p class="muted">Arraste a janela que abrir para a TV e clique nela para ficar em tela cheia. Na TV aparece só o mapa e o que você mandar; respostas e segredos ficam aqui.</p>
      </section>
      <section class="card">
        <h2>Mapa na TV</h2>
        <div class="seg">
          <button class="${tv.map === null ? "on" : ""}" data-act="tv-map" data-id="">Tela preta</button>
          ${Object.entries(Stage.MAPS).map(([id, m]) => `<button class="${tv.map === id ? "on" : ""}" data-act="tv-map" data-id="${id}">${esc(m.label)}</button>`).join("")}
        </div>
        <p class="warn-text">O Mapa 02 revela a sala secreta e o 03 revela o duto. Só troque quando eles descobrirem.</p>
        <div class="seg">
          <span class="seg-label">Personagens</span>
          <button class="${tv.style === "corpo" ? "on" : ""}" data-act="tv-style" data-id="corpo">Corpo inteiro</button>
          <button class="${tv.style === "ficha" ? "on" : ""}" data-act="tv-style" data-id="ficha">Ficha redonda</button>
          <span class="seg-label">Tamanho</span>
          <input type="range" min="0.6" max="1.8" step="0.1" value="${tv.size}" data-input="tv-size">
          <span class="tag">${sizePct}%</span>
          <button class="ghost" data-act="tv-reset-pos">Voltar às posições iniciais</button>
        </div>
        <p class="muted">Arraste os personagens no mapa ao lado; a TV acompanha na hora. Desacordado aparece deitado, morto fica deitado e escurecido no lugar, e quem escapou some da TV.${tv.map === null ? " A TV está em tela preta; aqui aparece o Mapa 01 só pra você posicionar." : ""}</p>
      </section>
      </div>
      <section class="card tv-map-card">
        <div class="editor">
          <div class="stage ${tv.map === null ? "dim" : ""}" id="gm-stage">
            <img class="map" src="${Stage.MAPS[mapKey].file}" alt="" draggable="false">
            <div class="tokens" id="gm-tokens"></div>
          </div>
        </div>
      </section>
      </div>`;
  }

  const TAB_RENDER = { ritmo: () => Ritmo.tabHtml(S, ritmoCtx), celular: () => phoneSectionHtml(), tv: tabTv, caminho: tabCaminho, travas: tabTravas, hacks: tabHacks, handouts: tabHandouts, maldicao: tabMaldicao, referencia: tabReferencia, notas: tabNotas };

  function renderTab() {
    const scroll = $("#tab").scrollTop;
    $("#tab").innerHTML = TAB_RENDER[S.tab]();
    $("#tab").scrollTop = scroll;
    const notes = $("textarea[data-input=notes]");
    if (notes) notes.value = S.notes;
    const gmTokens = $("#gm-tokens");
    if (gmTokens) Stage.syncTokens(gmTokens, tvState(), true);
  }

  function render() {
    renderTopbar();
    renderReminders();
    renderChars();
    renderTabs();
    renderTab();
    document.body.classList.toggle("cursed", curseRound() !== null);
    save();
    pushTv();
  }

  function galleryItem(id) {
    for (const g of D.gallery) {
      const it = g.items.find((i) => i.id === id);
      if (it) return it;
    }
    return null;
  }

  const ACTIONS = {
    "round-next": () => { applyCurseLoss(); nextRound(); },
    "round-prev": () => { S.round = Math.max(1, S.round - 1); log(`Voltou para a rodada ${S.round}.`); },
    "curse-on": () => activateCurse(),
    "curse-off": () => {
      if (!confirm("Desfazer a ativação da maldição?")) return;
      S.curseStart = null;
      S.curseApplied = {};
      log("Ativação da maldição desfeita.");
    },
    "curse-apply": () => applyCurseLoss(),
    "idol-broken": () => { S.idolBroken = !S.idolBroken; log(S.idolBroken ? "Ídolo marcado como quebrado." : "Ídolo desmarcado como quebrado."); },
    music: (el) => toggleMusic(el.dataset.id),
    reset: () => {
      if (!confirm("Começar uma sessão nova? Isso apaga rodadas, PV, PD, travas e notas.")) return;
      Object.values(music).forEach((a) => a.pause());
      S = freshState(S.players);
      if (SERVED) phoneAction("reset");
    },
    tab: (el) => { S.tab = el.dataset.id; },
    stat: (el) => changeStat(el.dataset.id, el.dataset.stat, Number(el.dataset.delta)),
    "test-pass": (el) => {
      S.chars[el.dataset.id][el.dataset.stat + "Pending"] = false;
      log(`${charDef(el.dataset.id).name} passou no teste de ${testName(el.dataset.stat)}.`);
    },
    "test-fail": (el) => {
      const c = S.chars[el.dataset.id];
      c[el.dataset.stat + "Pending"] = false;
      c.status = "morto";
      log(`${charDef(el.dataset.id).name} morreu.`);
    },
    "pd-line-hide": (el) => {
      S.chars[el.dataset.id].pdLine = null;
    },
    skip: (el) => {
      const c = S.chars[el.dataset.id];
      c.skipRound = c.skipRound === S.round + 1 ? null : S.round + 1;
    },
    damaged: (el) => { const c = S.chars[el.dataset.id]; c.damagedOther = !c.damagedOther; },
    breaker: (el) => {
      S.breakers[el.dataset.id] = !S.breakers[el.dataset.id];
      log(`Disjuntor "${el.dataset.id === "porao" ? "Porão" : "Segredo"}" ${S.breakers[el.dataset.id] ? "ligado" : "desligado"}.`);
    },
    "door-try": () => {
      const d = S.door;
      const code = (d.input.match(/\d/g) || []).join("");
      if (!S.breakers.porao) { d.message = "Sem energia: o teclado não acende. O disjuntor \"Porão\" está desligado."; return; }
      if (Ritmo.blocksDoorTry(S)) return;
      if (d.lockedUntil !== null) { d.message = `Teclado bloqueado até a rodada ${d.lockedUntil}.`; return; }
      if (code.length !== 6) { d.message = "A senha tem 6 dígitos (DDMMAA)."; return; }
      if (code === D.doorCode) {
        if (Ritmo.interceptCorrectCode(S, ritmoCtx)) return;
        d.open = true;
        d.message = "A porta abre. Quem sair agora escapa.";
        S.steps.porta = true;
        log("Porta de saída aberta.");
        return;
      }
      d.errors += 1;
      d.input = "";
      if (d.errors >= 3) {
        d.lockedUntil = S.round + 2;
        d.message = `Terceiro erro: teclado bloqueado até a rodada ${d.lockedUntil}.`;
        log(`Senha errada (${code}). Teclado bloqueado até a rodada ${d.lockedUntil}.`);
      } else {
        d.message = `Senha errada (${code}). A tela pisca vermelho.`;
        log(`Senha errada na porta (${code}).`);
      }
    },
    "lock-gen": (el) => {
      const def = lockDef(el.dataset.id);
      S.locks[def.id] = { ...S.locks[def.id], code: Array.from({ length: def.dice }, () => roll(def.sides)), reveal: false, tries: 0, status: "fechada", feedback: null, guess: "" };
      log(`${def.name}: senha secreta gerada.`);
    },
    "lock-reveal": (el) => { const st = S.locks[el.dataset.id]; st.reveal = !st.reveal; },
    "lock-check": (el) => checkLock(el.dataset.id),
    "lock-key": (el) => openLock(el.dataset.id, "chave"),
    "lock-break": (el) => {
      const def = lockDef(el.dataset.id);
      const st = S.locks[def.id];
      const ra = Number(st.ra);
      if (!ra) return;
      st.breakAcc += ra;
      st.ra = "";
      log(`${def.name}: arrombamento +${ra} (total ${st.breakAcc} de ${def.breakPA}).`);
      if (st.breakAcc >= def.breakPA) openLock(def.id, "força");
    },
    "lock-reset": (el) => {
      const def = lockDef(el.dataset.id);
      S.locks[def.id] = { code: [], reveal: false, tries: 0, status: "fechada", guess: "", feedback: null, breakAcc: 0, ra: "" };
    },
    "hack-target": (el) => { S.hack.target = el.dataset.id; },
    "hack-band": (el) => { S.hack.band = el.dataset.id; },
    "hack-show": () => {
      const plan = hackPlan();
      if (plan.auto) return;
      S.hack.attempts[S.hack.target] += 1;
      S.hack.last = { target: S.hack.target, attempt: plan.attempt, answer: plan.answer, seconds: plan.seconds };
      log(`Hack técnico (${plan.def.label}), tentativa ${plan.attempt}, ${plan.seconds} s. Resposta: ${plan.answer}.`);
      const show = { src: `assets/hack/${plan.image}.png`, caption: plan.def.question, seconds: plan.seconds, label: `Hack: ${plan.def.label}` };
      if (tvConnected()) showOnTv(show);
      else showOverlay(show);
    },
    "hack-solved": () => {
      const t = S.hack.target;
      S.hack.solved[t] = !S.hack.solved[t];
      if (S.hack.solved[t]) log(`Hack técnico resolvido: ${D.hack[t].label}.`);
    },
    "hack-reset": () => { S.hack.attempts[S.hack.target] = 0; S.hack.solved[S.hack.target] = false; S.hack.last = null; },
    "social-calc": () => {},
    "social-mark": (el) => {
      const m = S.social.marks;
      m[el.dataset.id] = m[el.dataset.id] === el.dataset.val ? undefined : el.dataset.val;
      if (socialSummary().right >= D.social.needed) { S.steps.celular = true; log("Celular do Gustavo desbloqueado."); }
    },
    "social-reset": () => { S.social = { result: "", marks: {} }; },
    phone: (el) => {
      const value = el.dataset.value === undefined ? undefined : el.dataset.value === "1" ? true : el.dataset.value === "0" ? false : Number(el.dataset.value);
      phoneAction(el.dataset.phone, value);
    },
    "phone-intuition": () => {
      phoneAction("intuition", phoneIntuitionDraft === "" ? null : Number(phoneIntuitionDraft));
      phoneIntuitionDraft = "";
    },
    "server-start": () => { startServer(); },
    "server-go": () => goServed(),
    "server-stop": () => { stopServer(); },
    "phone-reset": () => {
      if (confirm("Zerar o celular? Volta a ficar desligado e bloqueado.")) phoneAction("reset");
    },
    "phone-copy": () => {
      if (gm && navigator.clipboard) navigator.clipboard.writeText(gm.phoneUrl).catch((err) => console.warn("Cópia recusada.", err));
    },
    "phone-qr-big": () => {
      if (gm) showOverlay({ src: qrDataUrl(gm.phoneUrl, 16), caption: "Aponte a câmera do celular" });
    },
    "phone-qr-tv": () => {
      if (!gm) return;
      if (tvConnected()) showOnTv({ src: qrDataUrl(gm.phoneUrl, 16), caption: "Quem está com o celular do Gustavo: aponte a câmera", seconds: 0, label: "QR do celular" });
      else showOverlay({ src: qrDataUrl(gm.phoneUrl, 16), caption: "Aponte a câmera do celular" });
    },
    "tv-open": () => {
      tvWin = window.open("jogadores.html", "op2-jogadores", "popup=yes,width=1280,height=760");
      tvMsg = tvWin ? "" : "O navegador bloqueou a janela. Permita pop-ups para este arquivo e tente de novo.";
      if (tvWin) setTimeout(pushTv, 600);
    },
    "tv-map": (el) => {
      S.tv.map = el.dataset.id || null;
      log(`TV: ${S.tv.map ? Stage.MAPS[S.tv.map].label : "tela preta"}.`);
    },
    "tv-style": (el) => { S.tv.style = el.dataset.id; },
    "tv-reset-pos": () => { S.tv.positions = JSON.parse(JSON.stringify(D.tvStart)); },
    "tv-clear": () => {
      S.tv.show = null;
      clearInterval(tvShowTimer);
    },
    "tv-show": (el) => {
      const it = galleryItem(el.dataset.id);
      if (!it) return;
      S.shown[it.id] = true;
      if (tvConnected()) {
        showOnTv({ src: `assets/${it.file}`, caption: "", seconds: 0, label: it.title });
        log(`Na TV: ${it.title}.`);
      } else {
        showOverlay({ src: `assets/${it.file}` });
      }
    },
    show: (el) => {
      const it = galleryItem(el.dataset.id);
      if (!it) return;
      S.shown[it.id] = true;
      showOverlay({ src: `assets/${it.file}` });
    },
    roll: (el) => {
      const sides = Number(el.dataset.sides);
      const n = Math.max(1, Math.min(10, Number(S.dice.count) || 1));
      const vals = Array.from({ length: n }, () => roll(sides));
      S.dice.out = `${n}d${sides}: ${vals.join(", ")}${n > 1 ? ` (soma ${vals.reduce((a, b) => a + b, 0)})` : ""}`;
    },
    "roll-test": () => {
      const a = roll(S.dice.attr);
      const b = roll(S.dice.skill);
      const crit = a === b && a >= 6;
      const fail = a === 1 && b === 1;
      let text = `d${S.dice.attr}=${a}, d${S.dice.skill}=${b} · total ${a + b} · RA ${Math.max(a, b)} · RB ${Math.min(a, b)}`;
      if (crit) text += " · CRÍTICO";
      if (fail) text += ` · FALHA CRÍTICA: ${D.critFail[roll(8) - 1]}`;
      S.dice.test = text;
    }
  };

  const INPUTS = {
    players: (el) => {
      const players = Mesa.normalizePlayers(el.value);
      if (players === S.players) return false;
      if (S.round > 1 && !confirm(`Mudar para ${players} jogadores no meio da sessão? Edgar e Kênia voltam ao estado inicial.`)) return true;
      S.players = players;
      S.chars = alignChars(S.chars, players);
      D.characters.filter((def) => def.playableFrom).forEach((def) => {
        S.chars[def.id] = { ...S.chars[def.id], status: Mesa.initialStatus(def, players) };
      });
      log(`Mesa de ${players} jogadores.`);
      return true;
    },
    volume: (el) => { S.volume = Number(el.value); Object.values(music).forEach((a) => { a.volume = S.volume; }); return false; },
    status: (el) => { S.chars[el.dataset.id].status = el.value; log(`${charDef(el.dataset.id).name}: ${STATUS.find(([v]) => v === el.value)[1].toLowerCase()}.`); return true; },
    step: (el) => { S.steps[el.dataset.id] = el.checked; return true; },
    door: (el) => { S.door.input = el.value; return false; },
    guess: (el) => { S.locks[el.dataset.id].guess = el.value; return false; },
    ra: (el) => { S.locks[el.dataset.id].ra = el.value; return false; },
    "social-result": (el) => { S.social.result = el.value; return false; },
    shown: (el) => { S.shown[el.dataset.id] = el.checked; return true; },
    notes: (el) => { S.notes = el.value; return false; },
    "dice-count": (el) => { S.dice.count = Number(el.value) || 1; return false; },
    "dice-attr": (el) => { S.dice.attr = Number(el.value); return true; },
    "dice-skill": (el) => { S.dice.skill = Number(el.value); return true; },
    "phone-q": (el) => {
      if (!gm) return false;
      const id = Number(el.dataset.id);
      const chosen = new Set(gm.state.questions);
      if (el.checked) chosen.add(id);
      else chosen.delete(id);
      phoneAction("questions", [...chosen].sort((a, b) => a - b));
      return false;
    },
    "phone-intuition": (el) => { phoneIntuitionDraft = el.value; return false; },
    "tv-size": (el) => {
      S.tv.size = Number(el.value);
      const gmTokens = $("#gm-tokens");
      if (gmTokens) Stage.syncTokens(gmTokens, tvState(), true);
      const tag = el.nextElementSibling;
      if (tag) tag.textContent = `${Math.round(S.tv.size * 100)}%`;
      queuePush();
      return false;
    }
  };

  Object.assign(ACTIONS, Ritmo.actions(ritmoCtx));
  Object.assign(INPUTS, Ritmo.inputs(ritmoCtx));

  document.addEventListener("click", (ev) => {
    ensureAudio();
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    fn(el);
    render();
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]");
    if (!el) return;
    const fn = INPUTS[el.dataset.input];
    if (!fn) return;
    const rerender = fn(el);
    if (rerender && el.type !== "text" && el.tagName !== "TEXTAREA") render();
    else save();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#overlay").hidden) {
      hideOverlay();
      return;
    }
    if (ev.key !== "Enter") return;
    const el = ev.target.closest("[data-input]");
    if (!el) return;
    if (el.dataset.input === "phone-intuition") {
      ACTIONS["phone-intuition"]();
      return;
    }
    const map = { door: ["door-try"], guess: ["lock-check", el.dataset.id], ra: ["lock-break", el.dataset.id], "social-result": ["social-calc"] };
    const hit = map[el.dataset.input];
    if (!hit) return;
    ACTIONS[hit[0]]({ dataset: { id: hit[1] } });
    render();
    const again = hit[1] ? $(`[data-input="${el.dataset.input}"][data-id="${hit[1]}"]`) : $(`[data-input="${el.dataset.input}"]`);
    if (again && !again.disabled) again.focus();
  });

  document.addEventListener("toggle", (ev) => {
    const id = ev.target.dataset && ev.target.dataset.details;
    if (!id) return;
    if (ev.target.open) openDetails.add(id);
    else openDetails.delete(id);
  }, true);

  window.addEventListener("message", (ev) => {
    const ownOrigin = [location.origin, "null", "file://", SERVER_ORIGIN, "http://127.0.0.1:8765"].includes(ev.origin);
    if (!ownOrigin || !ev.data || ev.data.type !== "op2-hello") return;
    const wasConnected = tvConnected();
    tvWin = ev.source;
    lastHello = Date.now();
    tvWin.postMessage(tvState(), "*");
    if (!wasConnected) {
      tvMsg = "";
      updateTvChip();
    }
  });

  function stagePoint(ev, rect) {
    return {
      x: Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100))
    };
  }

  document.addEventListener("pointerdown", (ev) => {
    const tk = ev.target.closest("#gm-tokens .tk");
    if (!tk) return;
    ev.preventDefault();
    const rect = $("#gm-stage").getBoundingClientRect();
    const id = tk.dataset.token;
    const pos = S.tv.positions[id];
    const p = stagePoint(ev, rect);
    drag = { id, el: tk, rect, dx: pos.x - p.x, dy: pos.y - p.y };
    tk.classList.add("dragging");
    tk.setPointerCapture(ev.pointerId);
  });

  document.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = stagePoint(ev, drag.rect);
    const x = Math.max(0, Math.min(100, p.x + drag.dx));
    const y = Math.max(0, Math.min(100, p.y + drag.dy));
    S.tv.positions[drag.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    drag.el.style.left = `${x}%`;
    drag.el.style.top = `${y}%`;
    drag.el.style.zIndex = String(Math.round(y * 10));
    queuePush();
  });

  document.addEventListener("pointerup", () => {
    if (!drag) return;
    drag.el.classList.remove("dragging");
    drag = null;
    save();
    pushTv();
  });

  setInterval(() => {
    updateTvChip();
    const clock = $("#clock-chip b");
    if (clock) clock.textContent = Ritmo.clockText(S) + (Ritmo.clockRunning(S) ? "" : " ❚❚");
  }, 1000);

  if (SERVED) resumeSync();
  else {
    watchServer();
    setInterval(watchServer, 5000);
  }

  if (S.tv.show && S.tv.show.seconds && Date.now() > S.tv.show.startedAt + S.tv.show.seconds * 1000) S.tv.show = null;
  watchTvShow();

  $("#ov-close").addEventListener("click", hideOverlay);
  $("#ov-stage").addEventListener("click", (ev) => {
    if (ev.target.id === "ov-img") $("#ov-stage").classList.toggle("zoom");
  });

  render();
})();
