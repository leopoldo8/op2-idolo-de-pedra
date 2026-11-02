(function (root) {
  "use strict";

  const PLAYER_OPTIONS = [3, 4, 5];
  const DEFAULT_PLAYERS = 4;

  function isVariantMap(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
  }

  function pick(value, players) {
    if (!isVariantMap(value)) return value;
    const best = Object.keys(value).map(Number).filter((k) => k <= players).sort((a, b) => b - a)[0];
    return best === undefined ? undefined : value[best];
  }

  function role(def, players) {
    if (!def.playableFrom || players >= def.playableFrom) return "playable";
    return def.corpse ? "corpse" : "absent";
  }

  function initialStatus(def, players) {
    const r = role(def, players);
    if (r === "corpse") return "morto";
    if (r === "absent") return "ausente";
    return def.startStatus || "ativo";
  }

  function view(def, players) {
    const r = role(def, players);
    const corpse = r === "corpse" ? def.corpse : null;
    return {
      ...def,
      role: r,
      tvName: corpse ? corpse.tvName : def.name,
      start: corpse ? corpse.start : pick(def.start, players),
      secret: corpse ? corpse.secret : pick(def.secret, players)
    };
  }

  function normalizePlayers(value) {
    const n = Number(value);
    return PLAYER_OPTIONS.includes(n) ? n : DEFAULT_PLAYERS;
  }

  const api = { PLAYER_OPTIONS, DEFAULT_PLAYERS, pick, role, initialStatus, view, normalizePlayers };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Mesa = api;
})(typeof window !== "undefined" ? window : globalThis);
