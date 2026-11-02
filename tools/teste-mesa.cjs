const path = require("node:path");
const M = require(path.join(__dirname, "..", "painel-do-mestre", "mesa.js"));
global.window = {};
require(path.join(__dirname, "..", "painel-do-mestre", "data.js"));
const D = window.DATA;
const def = (id) => D.characters.find((c) => c.id === id);

let failures = 0;
function check(label, ok, extra) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra !== undefined ? `: ${extra}` : ""}`);
}

check("plain values pass through", M.pick("x", 3) === "x" && Array.isArray(M.pick(["a"], 3)));
check("variant map picks the largest key not above players", M.pick({ 3: "a", 4: "b" }, 5) === "b" && M.pick({ 3: "a", 4: "b" }, 3) === "a");
check("variant map with no matching key is undefined", M.pick({ 5: "a" }, 4) === undefined);
check("non-numeric objects are not variant maps", M.pick({ pv: 1 }, 3).pv === 1);
check("unknown player count falls back to default", M.normalizePlayers("7") === M.DEFAULT_PLAYERS && M.normalizePlayers(undefined) === M.DEFAULT_PLAYERS);

for (const players of M.PLAYER_OPTIONS) {
  const playable = D.characters.filter((c) => M.role(c, players) === "playable");
  check(`${players} players: playable count matches`, playable.length === players, playable.map((c) => c.id).join(","));
  const reminders = [1, 2].map((r) => M.pick(D.roundReminders[r], players));
  check(`${players} players: round reminders exist`, reminders.every((r) => Array.isArray(r) && r.length > 0));
  check(`${players} players: every step has text`, D.steps.every((s) => typeof M.pick(s.text, players) === "string"));
  check(`${players} players: survivors needed leaves at least one death`, players - D.survivorsNeeded >= 1);
}

check("3 players: Edgar is a corpse named for the TV", M.role(def("edgar"), 3) === "corpse" && M.view(def("edgar"), 3).tvName === "Homem no altar");
check("3 players: Edgar starts dead", M.initialStatus(def("edgar"), 3) === "morto");
check("3 players: Kênia is absent", M.initialStatus(def("kenia"), 3) === "ausente");
check("4 players: Edgar starts unconscious", M.initialStatus(def("edgar"), 4) === "inconsciente");
check("4 players: Kênia is absent", M.role(def("kenia"), 4) === "absent");
check("5 players: Kênia starts unconscious", M.initialStatus(def("kenia"), 5) === "inconsciente");
check("3 players: Eloísa's secret mentions killing Edgar", /matou o Edgar/.test(M.view(def("eloisa"), 3).secret));
check("4 players: Eloísa's secret does not", !/matou o Edgar/.test(M.view(def("eloisa"), 4).secret));
check("3 players: knife is not in the metal cabinet", !/faca de churrasco,/.test(M.pick(D.steps.find((s) => s.id === "armario").text, 3)));
check("4 players: knife is in the metal cabinet", /faca de churrasco,/.test(M.pick(D.steps.find((s) => s.id === "armario").text, 4)));
check("chains lock only from 4 players", D.locks.find((l) => l.id === "correntes").minPlayers === 4);
check("every character has a TV start position", D.characters.every((c) => D.tvStart[c.id]));

console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
