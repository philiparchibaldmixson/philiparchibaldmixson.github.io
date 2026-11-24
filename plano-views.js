(() => {
  "use strict";
  const { LANGS, topics, state, esc, itemsOf, buildPlan, logOf, isDone } = window.PK;

  const MODES = {
    kids: { icon: "🧒", title: "Criança", text: "Jogos, estrelas e voz animada" },
    adult: { icon: "🧑", title: "Adulto com dificuldade", text: "Ritmo lento, voz devagar e letras grandes" }
  };

  const chip = (act, v, label, on) => `<button type="button" class="chip${on ? " on" : ""}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;

  function homeView() {
    const nativeChips = Object.entries(LANGS).map(([k, L]) => chip("native", k, `${L.flag} ${L.name}`, state.native === k)).join("");
    const modes = Object.entries(MODES).map(([k, m]) => `
      <button type="button" class="mode${state.mode === k ? " on" : ""}" data-act="mode" data-v="${k}" aria-pressed="${state.mode === k}">
        <span class="mode-i">${m.icon}</span><strong>${m.title}</strong><small>${m.text}</small>
      </button>`).join("");
    const mins = [10, 15, 20, 30].map(m => chip("minutes", m, `${m} min`, state.minutes === m)).join("");
    const cards = Object.entries(LANGS).map(([k, L]) => {
      const plan = buildPlan(k);
      const done = plan.sessions.filter(s => isDone(k, s.key)).length;
      const pct = Math.round(done / plan.sessions.length * 100);
      return `<a class="lang-card" href="#${k}" style="--c:var(--l${L.col})">
        <span class="flag">${L.flag}</span><strong>${esc(L.full)}</strong><em>${esc(L.hello)}</em>
        <span class="meter"><i style="width:${pct}%"></i></span><small>${done}/${plan.sessions.length} lições</small></a>`;
    }).join("");
    const preview = topics.map(t => `<span class="pill" style="--c:${t.color}">${t.icon} ${esc(t.names.pt)}</span>`).join("");
    return `
      <section class="hero">
        <div class="hero-emojis" aria-hidden="true"><span>🍎</span><span>🐱</span><span>🏠</span><span>🌈</span><span>🎈</span></div>
        <h1>Aprenda idiomas <em>brincando!</em></h1>
        <p>Um plano de estudos feito sob medida, com figuras, sons, jogos e vídeos. Extensão dos cursos de Português, English, Español, Italiano e Français.</p>
      </section>
      <section class="panel setup">
        <h2><b>1</b> Em qual idioma você fala melhor?</h2><div class="chips">${nativeChips}</div>
        <h2><b>2</b> Quem vai estudar?</h2><div class="modes">${modes}</div>
        <h2><b>3</b> Quanto tempo por dia?</h2><div class="chips">${mins}</div>
        <h2><b>4</b> O que você quer aprender?</h2><div class="lang-grid">${cards}</div>
      </section>
      <section class="panel"><h2>🧸 O que vamos aprender</h2><div class="pills">${preview}</div></section>`;
  }

  function langView(lang) {
    const L = LANGS[lang];
    const plan = buildPlan(lang);
    const done = plan.sessions.filter(s => isDone(lang, s.key)).length;
    const next = plan.sessions.find(s => !isDone(lang, s.key));
    const pct = Math.round(done / plan.sessions.length * 100);
    const mode = MODES[state.mode];

    const topicCards = topics.map(t => {
      const stars = Math.max(0, ...plan.sessions.filter(s => s.topic === t).map(s => logOf(lang, s.key).quiz || 0));
      return `<a class="topic" href="#${lang}/${t.id}" style="--c:${t.color}">
        <span class="t-i">${t.icon}</span><strong>${esc(t.names[lang])}</strong>
        <small>${esc(t.names[state.native] !== t.names[lang] ? t.names[state.native] : t.desc[lang])}</small>
        <span class="stars" aria-label="${stars} de 3 estrelas">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span></a>`;
    }).join("");

    const weeks = plan.weeks.map(w => {
      const rows = w.sessions.map((s, i) => {
        const ok = isDone(lang, s.key);
        const isNext = next && next.key === s.key;
        const preview = itemsOf(s.topic, lang).slice(s.from, s.to).map(x => x.e).join(" ");
        return `<li class="${ok ? "ok" : ""}${isNext ? " next" : ""}">
          <span class="chk" aria-hidden="true">${ok ? "✅" : isNext ? "👉" : "⭕"}</span>
          <div><strong>Dia ${i + 1} · ${s.topic.icon} ${esc(s.topic.names[lang])}</strong><small>Parte ${s.part} de ${s.parts} · ${esc(preview)}</small></div>
          <a class="go" href="#${lang}/${s.topic.id}/${s.part}">${ok ? "Rever" : "Começar"}</a></li>`;
      }).join("");
      const rev = isDone(lang, w.review.key);
      return `<article class="week"><h3>Semana ${w.n}</h3><ol class="days">${rows}
        <li class="rev${rev ? " ok" : ""}"><span class="chk" aria-hidden="true">${rev ? "✅" : "🏆"}</span>
        <div><strong>Dia 5 · Revisão da semana</strong><small>Jogo misto com tudo que você viu</small></div>
        <a class="go" href="#${lang}/rev/${w.n}">Jogar</a></li></ol></article>`;
    }).join("");

    return `
      <a class="crumb" href="#">← Início</a>
      <header class="langhead" style="--c:var(--l${L.col})">
        <span class="flag big">${L.flag}</span>
        <div><h1>Plano de estudos · ${esc(L.full)}</h1>
        <p>${mode.icon} ${mode.title} · ${state.minutes} min por dia · ${plan.perDay} palavras por lição · ${plan.weeks.length} semanas</p>
        <div class="meter wide"><i style="width:${pct}%"></i></div><small>${done} de ${plan.sessions.length} lições concluídas (${pct}%)</small></div>
        <div class="head-actions">
          ${next ? `<a class="btn" href="#${lang}/${next.topic.id}/${next.part}">▶ Continuar</a>` : `<span class="btn done">🎉 Plano completo!</span>`}
          <a class="btn ghost" href="index.html#lang-${L.num}">📚 Curso de gramática</a>
        </div>
      </header>
      <section class="panel"><h2>🎒 Temas livres</h2><p class="sub">Toque em qualquer tema para estudar na ordem que preferir.</p><div class="topic-grid">${topicCards}</div></section>
      <section class="panel"><h2>🗓️ Meu plano semana a semana</h2><p class="sub">Quatro dias de palavras novas e um dia de revisão por semana.</p><div class="weeks">${weeks}</div></section>`;
  }

  window.PKViews = { homeView, langView, MODES };
})();
