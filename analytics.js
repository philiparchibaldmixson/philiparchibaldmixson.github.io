(() => {
  "use strict";

  const code = ((window.ANALYTICS || {}).goatcounter || "").trim();
  if (!/^[a-z0-9-]+$/i.test(code)) return;

  // Não conta os testes do painel (iframes) nem quem desligou a contagem neste navegador.
  if (window.self !== window.top) return;
  try { if (localStorage.getItem("skipgc")) return; } catch (_) { /* storage unavailable */ }

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  document.head.appendChild(s);
})();
