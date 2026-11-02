window.Stage = (function () {
  "use strict";

  const MAPS = {
    m01: { file: "assets/mapas/m01.jpg", label: "Mapa 01: o porão" },
    m02: { file: "assets/mapas/m02.jpg", label: "Mapa 02: porão e sala secreta" },
    m03: { file: "assets/mapas/m03.jpg", label: "Mapa 03: completo, com o duto" }
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function tokenHtml(token, style, size, forGm) {
    if (token.status === "escapou" && !forGm) return "";
    const tokenStyle = token.fixedStyle || style;
    const img = tokenStyle === "ficha" ? `assets/fichas-mapa/${token.id}.png` : `assets/personagens/${token.id}.png`;
    return `<div class="tk tk-${tokenStyle} st-${token.status}${token.monster ? " tk-monstro" : ""}" data-token="${token.id}" style="left:${token.x}%;top:${token.y}%;--s:${size};z-index:${Math.round(token.y * 10)}">
      <img src="${img}" alt="" draggable="false"><span>${esc(token.name)}${forGm && token.status === "escapou" ? " (escapou)" : ""}</span></div>`;
  }

  function tokensHtml(state, forGm) {
    return state.tokens.map((t) => tokenHtml(t, state.style, state.size, forGm)).join("");
  }

  function syncTokens(container, state, forGm) {
    const fresh = document.createElement("div");
    fresh.innerHTML = tokensHtml(state, forGm);
    const wanted = new Set();
    [...fresh.children].forEach((el) => {
      const id = el.dataset.token;
      wanted.add(id);
      const old = container.querySelector(`[data-token="${id}"]`);
      if (!old) {
        container.appendChild(el);
        return;
      }
      if (old.querySelector("img").getAttribute("src") !== el.querySelector("img").getAttribute("src")) {
        old.replaceWith(el);
        return;
      }
      old.className = el.className + (old.classList.contains("dragging") ? " dragging" : "");
      old.setAttribute("style", el.getAttribute("style"));
      old.querySelector("span").innerHTML = el.querySelector("span").innerHTML;
    });
    [...container.children].forEach((el) => {
      if (!wanted.has(el.dataset.token)) el.remove();
    });
  }

  return { MAPS, tokensHtml, syncTokens };
})();
