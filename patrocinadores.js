/*
  PATROCINADORES
  Para adicionar um parceiro, inclua uma linha na lista abaixo:
    { name: "Nome da empresa", url: "https://site.com", logo: "imagens/logo.png", tag: "Frase curta", tier: "master" }
  - tier: "master" (destaque), "ouro" ou "apoio"
  - logo e tag são opcionais; sem logo, aparece o nome em destaque
  - os patrocinadores "master" e "ouro" também aparecem na faixa abaixo do topo
*/
window.SPONSORS = [
];

(() => {
  "use strict";

  const CONTACT = {
    email: "philiparchibaldmixson@outlook.com",
    subject: "Patrocínio · Língua Academy",
    body: "Olá, Filipe! Tenho interesse em patrocinar o site. Nome da empresa:\nSite:\nTelefone:"
  };
  const MAIL = `mailto:${CONTACT.email}?subject=${encodeURIComponent(CONTACT.subject)}&body=${encodeURIComponent(CONTACT.body)}`;

  const TIERS = [
    { id: "master", title: "Patrocinador master", icon: "👑", slots: 1 },
    { id: "ouro", title: "Patrocinadores ouro", icon: "🥇", slots: 3 },
    { id: "apoio", title: "Apoiadores", icon: "🤝", slots: 4 }
  ];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => (/^https?:\/\//i.test(u) ? u : "#");
  const list = (window.SPONSORS || []).filter(s => s && s.name);

  function logoHTML(s) {
    return s.logo
      ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy">`
      : `<span class="sp-word">${esc(s.name)}</span>`;
  }

  function card(s, size) {
    return `<a class="sp sp-${size}" href="${esc(safeUrl(s.url))}" target="_blank" rel="sponsored noopener noreferrer" title="${esc(s.name)}">
      <span class="sp-logo">${logoHTML(s)}</span>${s.tag ? `<small>${esc(s.tag)}</small>` : ""}</a>`;
  }

  function slot(size) {
    return `<a class="sp sp-empty sp-${size}" href="${MAIL}" aria-label="Anunciar aqui: seu logotipo neste espaço">
      <span class="sp-logo"><span class="sp-plus" aria-hidden="true">＋</span><span class="sp-word">Seu logo aqui</span></span></a>`;
  }

  function renderStrip() {
    const el = document.getElementById("sponsorStrip");
    if (!el) return;
    const top = list.filter(s => s.tier === "master" || s.tier === "ouro").slice(0, 6);
    const items = top.length ? top.map(s => card(s, "sm")).join("") : [slot("sm"), slot("sm"), slot("sm")].join("");
    el.innerHTML = `<span class="sp-label">Patrocinadores</span>
      <div class="sp-row">${items}</div>
      <a class="sp-cta" href="#patrocinadores">Seja um patrocinador →</a>`;
  }

  function renderFull() {
    const el = document.getElementById("sponsorTiers");
    if (!el) return;
    el.innerHTML = TIERS.map(t => {
      const own = list.filter(s => (s.tier || "apoio") === t.id);
      const size = t.id === "master" ? "lg" : "md";
      const missing = Math.max(0, t.slots - own.length);
      const items = own.map(s => card(s, size)).join("") + Array.from({ length: missing }, () => slot(size)).join("");
      return `<div class="tier tier-${t.id}"><h3><span aria-hidden="true">${t.icon}</span> ${t.title}</h3><div class="tier-row">${items}</div></div>`;
    }).join("");
    const cta = document.getElementById("sponsorMail");
    if (cta) cta.href = MAIL;
  }

  renderStrip();
  renderFull();
})();
