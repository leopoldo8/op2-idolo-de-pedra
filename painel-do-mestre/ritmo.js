window.Ritmo = (function () {
  "use strict";

  const OPEN_DELAY = 3;
  const CURSE_KILL_ROUND = 14;
  const GUSTAVO_PV = 12;
  const DOWN_ROUNDS = 2;
  const FREEZER_POSITION = { x: 81, y: 14 };

  const TEXT = {
    codeAccepted: "O teclado apita e a tela fica verde: SENHA ACEITA. Um motor começa a girar dentro da porta, devagar demais, e a tela mostra DESTRAVANDO. Então, vindo da sala secreta, um estrondo metálico: a tampa do freezer bate com força. Uma vez. Duas.",
    rise: "A tampa do freezer se abre por dentro. Uma mão arroxeada agarra a borda, e a marca no pulso pulsa em vermelho. Gustavo se levanta com os membros torcidos para trás e o pescoço dobrado num ângulo impossível. Os olhos estão abertos, mas não tem mais ninguém ali dentro. A cabeça gira devagar na direção de vocês.",
    doorOpens: "Um estalo pesado, e a porta de ferro se solta do batente. Ar frio desce pela escada. Atrás de vocês, Gustavo dá mais um passo.",
    collapse: "Quando o último de vocês cruza a porta, o corpo de Gustavo desaba no chão do porão, como se os fios que o seguravam de pé tivessem sido cortados."
  };

  const RULES = [
    "Ao vê-lo de pé pela primeira vez: Disciplina DT 7. Falhou, perde 2 PD.",
    "Age por último na rodada, como os NPCs do livro. Uma ação por rodada: andar até o cômodo vizinho ou atacar alguém no mesmo cômodo.",
    "Da sala secreta ao porão: pela estante, só se alguém estiver segurando a passagem aberta (1 ação). Pelo duto: 1 ação para entrar e 1 para sair, mais 1 se a grade ainda estiver inteira.",
    "Ataque: rola d8 + d8 num teste oposto de Luta. Se vencer, causa dano igual à RB (mãos, desarmado) e agarra a vítima.",
    "Quem é atacado escolhe: lutar de volta (teste oposto de Luta; se vencer, quem fere é o personagem: RA armado, RB desarmado, faca RA + 2) ou esquivar (Acrobacia com +d6; se vencer, ninguém se fere).",
    "Agarrado não pode sair pela porta. Para se soltar: gasta a ação num teste oposto de Atletismo contra a Luta dele. Também se solta se alguém ferir o Gustavo.",
    `Tem ${GUSTAVO_PV} PV. Em 0 PV, desaba, mas se levanta de novo no início da segunda rodada seguinte, com PV cheio. Não dá pra matá-lo.`,
    "Ferir o Gustavo não conta como \"feriu outro personagem vivo\" para a maldição: ele não está vivo.",
    "Quando a porta abrir, sair gasta a ação de cada personagem. Ele não passa da porta."
  ];

  function fresh() {
    return { armed: false, risen: false, risenRound: null, pv: GUSTAVO_PV, downUntil: null, grabbed: null, lastRoll: null, doorOpenedRound: null };
  }

  function gustavo(S) {
    if (!S.gustavo) S.gustavo = fresh();
    return S.gustavo;
  }

  function opensAt(S) {
    return typeof S.door.opensAt === "number" ? S.door.opensAt : null;
  }

  function roundsLeft(S) {
    const at = opensAt(S);
    return at === null ? null : Math.max(0, at - S.round);
  }

  function isDown(S) {
    const g = gustavo(S);
    return g.downUntil !== null && S.round < g.downUntil;
  }

  function countdownText(left) {
    return left === 1 ? "abre no início da próxima rodada" : `abre em ${left} rodadas`;
  }

  function rumble(ctx) {
    if (ctx.rumble) ctx.rumble();
  }

  function rise(S, ctx) {
    const g = gustavo(S);
    if (g.risen) return;
    g.risen = true;
    g.risenRound = S.round;
    g.pv = GUSTAVO_PV;
    g.downUntil = null;
    g.grabbed = null;
    S.tv.positions.gustavo = { ...FREEZER_POSITION };
    if (S.tv.map === "m01") {
      S.tv.map = "m02";
      ctx.log("TV trocou para o Mapa 02 (o freezer fica na sala secreta).");
    }
    ctx.log("Gustavo se levanta do freezer.");
    rumble(ctx);
  }

  function interceptCorrectCode(S, ctx) {
    const g = gustavo(S);
    if (!g.armed || opensAt(S) !== null) return false;
    const c = ctx.curseRound();
    if (c !== null && c + OPEN_DELAY >= CURSE_KILL_ROUND) {
      ctx.log(`Gustavo não se levantou: a maldição está na rodada ${c}, e a espera de ${OPEN_DELAY} rodadas passaria da rodada ${CURSE_KILL_ROUND}. A porta abriu na hora.`);
      return false;
    }
    S.door.opensAt = S.round + OPEN_DELAY;
    S.door.message = `Senha aceita. Destravando: ${countdownText(OPEN_DELAY)}.`;
    S.door.input = "";
    ctx.log(`Senha certa, mas a porta só abre na rodada ${S.door.opensAt}.`);
    rise(S, ctx);
    return true;
  }

  function blocksDoorTry(S) {
    const left = roundsLeft(S);
    if (left === null) return false;
    S.door.message = `Senha já aceita. Destravando: ${countdownText(left)}.`;
    S.door.input = "";
    return true;
  }

  function onNextRound(S, ctx) {
    const at = opensAt(S);
    if (at !== null && !S.breakers.porao) {
      S.door.opensAt = at + 1;
      S.door.message = "Sem energia: a porta parou de destravar. A contagem volta quando o disjuntor \"Porão\" for religado.";
      ctx.log(`Disjuntor "Porão" desligado: a porta só abre na rodada ${S.door.opensAt}.`);
    } else if (at !== null && S.round >= at) {
      S.door.opensAt = null;
      S.door.open = true;
      S.door.message = "A porta destravou. Quem sair agora escapa.";
      S.steps.porta = true;
      gustavo(S).doorOpenedRound = S.round;
      ctx.log("Porta de saída destravada depois da espera.");
      if (ctx.beep) ctx.beep();
    } else if (at !== null) {
      S.door.message = `Senha aceita. Destravando: ${countdownText(at - S.round)}.`;
    }
    const g = gustavo(S);
    if (g.risen && g.downUntil !== null && S.round >= g.downUntil) {
      g.downUntil = null;
      g.pv = GUSTAVO_PV;
      ctx.log("Gustavo se levanta de novo.");
      rumble(ctx);
    }
  }

  function reminders(S, ctx) {
    const list = [];
    const g = gustavo(S);
    const left = roundsLeft(S);
    if (left !== null) {
      list.push(S.breakers.porao
        ? { kind: "curse", text: `Porta destravando: ${countdownText(left)} (rodada ${opensAt(S)}). Tentativas no teclado não fazem nada até lá.` }
        : { kind: "warn", text: "Porta parou de destravar: o disjuntor \"Porão\" está desligado. Cada rodada sem energia empurra a abertura uma rodada." });
    }
    if (g.risen && g.risenRound === S.round) list.push({ kind: "danger", text: "Leia agora (aba Ritmo, textos em voz alta): Gustavo se levanta. Disciplina DT 7 para quem o vir; falhou, perde 2 PD." });
    if (g.doorOpenedRound === S.round && S.door.open) list.push({ kind: "danger", text: "Leia agora (aba Ritmo): a porta abre. Sair gasta a ação de cada um; quem estiver agarrado não sai." });
    if (g.risen) {
      const where = isDown(S) ? `caído, levanta na rodada ${g.downUntil}` : `de pé, ${g.pv} de ${GUSTAVO_PV} PV, age por último`;
      list.push({ kind: "curse", text: `Gustavo: ${where}.${g.grabbed ? ` ${ctx.charName(g.grabbed)} está agarrado.` : ""}` });
      const c = ctx.curseRound();
      if (c === 13) list.push({ kind: "curse", text: "Maldição 13: Gustavo já está de pé. Descreva os outros cadáveres convulsionando (se houver)." });
      if (c !== null && c >= CURSE_KILL_ROUND) list.push({ kind: "danger", text: "Maldição 14+: vale a regra do livro. Gustavo absorve e mata o personagem mais próximo, sem teste." });
    }
    return list;
  }

  function doorPowered(S) {
    return !!S.breakers.porao;
  }

  function tvTokens(S) {
    const g = gustavo(S);
    if (!g.risen) return [];
    const pos = S.tv.positions.gustavo || FREEZER_POSITION;
    return [{ id: "gustavo", name: "Gustavo", status: isDown(S) ? "inconsciente" : "ativo", fixedStyle: "ficha", monster: true, ...pos }];
  }

  function clockMs(S) {
    const clock = S.clock || { startedAt: null, elapsed: 0 };
    return clock.elapsed + (clock.startedAt === null ? 0 : Date.now() - clock.startedAt);
  }

  function clockText(S) {
    const total = Math.floor(clockMs(S) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function clockRunning(S) {
    return !!(S.clock && S.clock.startedAt !== null);
  }

  function clockChipHtml(S) {
    return `<button class="chip srv-chip ${clockRunning(S) ? "ok" : ""}" id="clock-chip" data-act="clock-toggle" title="Tempo de sessão: clique para iniciar ou pausar"><span>Sessão</span><b>${clockText(S)}${clockRunning(S) ? "" : " ❚❚"}</b></button>`;
  }

  function hintsHtml(S, esc) {
    const shown = S.hintsShown || {};
    return (window.DICAS || []).map((h) => {
      const level = shown[h.id] || 0;
      const items = h.levels.map((text, i) => i < level
        ? `<li class="hint-on"><b>${i + 1}.</b> ${esc(text)}</li>`
        : `<li class="hint-off"><b>${i + 1}.</b> <span class="spoiler-block" tabindex="0">${esc(text)}</span></li>`).join("");
      return `<div class="hint-card">
        <div class="hint-head"><b>${esc(h.title)}</b>
          <span class="lock-row">
            <button data-act="hint-next" data-id="${h.id}" ${level >= h.levels.length ? "disabled" : ""}>Marcar dica ${Math.min(level + 1, h.levels.length)} como dada</button>
            ${level ? `<button class="ghost" data-act="hint-reset" data-id="${h.id}">Zerar</button>` : ""}
          </span></div>
        <ol class="hint-list">${items}</ol></div>`;
    }).join("");
  }

  function gustavoHtml(S, ctx) {
    const esc = ctx.esc;
    const g = gustavo(S);
    const left = roundsLeft(S);
    const c = ctx.curseRound();
    const late = c !== null && c + OPEN_DELAY >= CURSE_KILL_ROUND;
    const lr = g.lastRoll;
    const status = !g.risen ? (g.armed ? "armado: dispara na senha certa" : "desligado") : isDown(S) ? `caído até a rodada ${g.downUntil}` : `de pé, ${g.pv} de ${GUSTAVO_PV} PV`;
    return `
      <section class="card">
        <h2>Rápido demais: Gustavo se levanta <span class="tag ${g.risen ? "danger" : g.armed ? "aberta" : ""}">${esc(status)}</span></h2>
        <p class="muted">Regra da casa, fora do livro. Armado, quando acertarem a senha da porta (no painel ou no celular), a porta só abre ${OPEN_DELAY} rodadas depois, e o corpo do Gustavo sai do freezer. Se a maldição estiver adiantada a ponto de a espera passar da rodada ${CURSE_KILL_ROUND} dela, a porta abre na hora e nada disso acontece.</p>
        ${late && g.armed && !g.risen ? `<p class="warn-text">A maldição já está na rodada ${c}: se acertarem a senha agora, a porta abre na hora.</p>` : ""}
        <div class="lock-row">
          <button class="${g.armed ? "on" : "primary"}" data-act="gustavo-arm" ${g.risen ? "disabled" : ""}>${g.armed ? "Armado (clique para desarmar)" : "Armar para a senha da porta"}</button>
          <button class="danger-btn" data-act="gustavo-rise" ${g.risen ? "disabled" : ""}>Erguer o Gustavo agora</button>
          ${g.risen ? `<button class="ghost" data-act="gustavo-undo">Desfazer</button>` : ""}
        </div>
        ${left !== null ? `<p class="door-msg">Porta: ${esc(countdownText(left))} (rodada ${opensAt(S)}).</p>` : ""}
        ${g.risen ? `
          <div class="lock-row">
            <button data-act="gustavo-roll">Rolar ataque (d8 + d8)</button>
            ${lr ? `<span class="tag">Rolou ${lr.dice.join(" e ")}: total ${lr.total}, RA ${lr.ra}, RB ${lr.rb}</span>` : ""}
          </div>
          <div class="lock-row">
            <span class="tag">PV ${g.pv} / ${GUSTAVO_PV}</span>
            ${[1, 2, 3, 5, 8].map((n) => `<button data-act="gustavo-hit" data-value="${n}">−${n}</button>`).join("")}
            <select data-input="gustavo-grab"><option value="">Ninguém agarrado</option>${ctx.characters.map((d) => `<option value="${d.id}" ${g.grabbed === d.id ? "selected" : ""}>${esc(d.name)} agarrado</option>`).join("")}</select>
          </div>` : ""}
        <details data-details="gustavo-texts" ${ctx.isOpen("gustavo-texts") ? "open" : ""}>
          <summary>Textos para ler em voz alta</summary>
          <p><b>Senha certa:</b> ${esc(TEXT.codeAccepted)}</p>
          <p><b>Ele se levanta:</b> ${esc(TEXT.rise)}</p>
          <p><b>A porta abre:</b> ${esc(TEXT.doorOpens)}</p>
          <p><b>O último sai:</b> ${esc(TEXT.collapse)}</p>
        </details>
        <details data-details="gustavo-rules" ${ctx.isOpen("gustavo-rules") ? "open" : ""}>
          <summary>Regras do Gustavo</summary>
          <ul>${RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        </details>
      </section>`;
  }

  function tabHtml(S, ctx) {
    return `
      <section class="card">
        <h2>Ritmo da mesa</h2>
        <ul>
          <li><b>Rápido demais:</b> arme o Gustavo abaixo antes de acertarem a senha.</li>
          <li><b>Travados num ponto:</b> use as dicas em três níveis, da mais sutil à quase resposta. Dê a próxima só se a anterior não destravar.</li>
          <li><b>Cansados ou perdendo o interesse:</b> o livro autoriza começar a maldição antes (aba Maldição).</li>
        </ul>
        <p class="muted">O relógio de sessão no topo conta o tempo real; clique nele para iniciar ou pausar.</p>
      </section>
      ${gustavoHtml(S, ctx)}
      <section class="card">
        <h2>Se travarem: dicas em três níveis</h2>
        <p class="muted">Passe o mouse para ler uma dica antes de dar. As dicas de nível 1 cabem na narração, como algo que os personagens percebem.</p>
        ${hintsHtml(S, ctx.esc)}
      </section>`;
  }

  function actions(ctx) {
    const S = () => ctx.state();
    return {
      "gustavo-arm": () => {
        const g = gustavo(S());
        g.armed = !g.armed;
        ctx.log(g.armed ? "Gustavo armado para a senha da porta." : "Gustavo desarmado.");
      },
      "gustavo-rise": () => {
        if (!confirm("Erguer o Gustavo agora? A porta continua funcionando normalmente.")) return;
        rise(S(), ctx);
      },
      "gustavo-undo": () => {
        if (!confirm("Desfazer o Gustavo? Ele volta para o freezer e a espera da porta é cancelada (a porta fica fechada).")) return;
        const state = S();
        state.gustavo = { ...fresh(), armed: gustavo(state).armed };
        state.door.opensAt = null;
        state.door.message = "";
        ctx.log("Gustavo desfeito.");
      },
      "gustavo-roll": () => {
        const g = gustavo(S());
        const dice = [ctx.roll(8), ctx.roll(8)];
        g.lastRoll = { dice, total: dice[0] + dice[1], ra: Math.max(...dice), rb: Math.min(...dice) };
        ctx.log(`Gustavo ataca: ${dice.join(" e ")} (total ${g.lastRoll.total}, RA ${g.lastRoll.ra}, RB ${g.lastRoll.rb}).`);
      },
      "gustavo-hit": (el) => {
        const state = S();
        const g = gustavo(state);
        if (isDown(state)) return;
        g.pv = Math.max(0, g.pv - Number(el.dataset.value));
        if (g.grabbed) {
          ctx.log(`${ctx.charName(g.grabbed)} se solta.`);
          g.grabbed = null;
        }
        if (g.pv === 0) {
          g.downUntil = state.round + DOWN_ROUNDS;
          ctx.log(`Gustavo desaba. Levanta de novo na rodada ${g.downUntil}.`);
        } else ctx.log(`Gustavo sofre ${el.dataset.value} de dano (${g.pv} PV).`);
      },
      "hint-next": (el) => {
        const state = S();
        state.hintsShown = { ...(state.hintsShown || {}) };
        const def = (window.DICAS || []).find((h) => h.id === el.dataset.id);
        const level = Math.min((state.hintsShown[el.dataset.id] || 0) + 1, def ? def.levels.length : 3);
        state.hintsShown[el.dataset.id] = level;
        if (def) ctx.log(`Dica ${level} dada: ${def.title}.`);
      },
      "hint-reset": (el) => {
        const state = S();
        state.hintsShown = { ...(state.hintsShown || {}), [el.dataset.id]: 0 };
      },
      "clock-toggle": () => {
        const state = S();
        const clock = state.clock || { startedAt: null, elapsed: 0 };
        state.clock = clock.startedAt === null
          ? { ...clock, startedAt: Date.now() }
          : { startedAt: null, elapsed: clock.elapsed + Date.now() - clock.startedAt };
      }
    };
  }

  function inputs(ctx) {
    return {
      "gustavo-grab": (el) => {
        const g = gustavo(ctx.state());
        g.grabbed = el.value || null;
        if (g.grabbed) ctx.log(`Gustavo agarra ${ctx.charName(g.grabbed)}.`);
        return true;
      }
    };
  }

  return { fresh, doorPowered, interceptCorrectCode, blocksDoorTry, onNextRound, reminders, tvTokens, roundsLeft, clockChipHtml, clockText, clockRunning, tabHtml, actions, inputs, FREEZER_POSITION };
})();
