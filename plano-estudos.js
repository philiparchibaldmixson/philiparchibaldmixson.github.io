(() => {
  "use strict";
  const PK = window.PK;
  const { LANGS, state, save, esc, norm, shuffle, getDeck, logOf, setLog, isDone, resources, speak, toast, confetti } = PK;
  const { homeView, langView } = window.PKViews;

  const app = document.getElementById("app");
  const $ = (s, r = document) => r.querySelector(s);
  let cur = null;
  let q = null;
  let mem = null;
  let wr = null;
  let sayToken = 0;

  const TABS = [["learn", "👀 Aprender"], ["memory", "🧠 Memória"], ["quiz", "❓ Quiz"], ["write", "✍️ Escrever"], ["dictation", "🎧 Ditado"], ["videos", "📺 Vídeos"]];
  const HOUSE = new Set(["sala", "cozinha", "banheiro", "lavanderia", "externa", "churrasqueira", "comodos", "quarto"]);
  const TIPS = {
    corpo: "Toque em cada parte do corpo enquanto fala a palavra.",
    numeros: "Conte em voz alta degraus, passos e objetos da casa, no novo idioma.",
    dezenas: "Leia em voz alta preços, placas e números de telefone.",
    cores: "Aponte objetos ao seu redor e diga a cor no novo idioma.",
    formas: "Procure formas pela casa: o prato é um círculo, a janela é um retângulo.",
    frutas: "Na feira ou no mercado, diga o nome de cada fruta no novo idioma.",
    legumes: "Na feira ou no mercado, diga o nome de cada legume no novo idioma.",
    alimentos: "Na hora das refeições, peça os alimentos no novo idioma.",
    refeicoes: "Use as frases na mesa: diga Bom apetite no novo idioma antes de comer.",
    clima: "Todo dia, olhe pela janela e diga como está o tempo.",
    dias: "Todo dia, diga em voz alta que dia da semana é hoje.",
    meses: "Diga a data de hoje e a data de aniversário de cada pessoa da família.",
    rimas: "Cante junto com o vídeo e depois recite sem olhar. As rimas ajudam a decorar.",
    sons: "Repita cada palavra devagar, prestando atenção na parte destacada pelo som.",
    frasesaula: "Brinque de escola: um é o professor e o outro é o aluno.",
    uteis: "Imagine uma viagem e ensaie cada frase em voz alta.",
    verbos: "Faça mímica de cada verbo enquanto fala a palavra.",
    rotina: "Narre o seu dia em voz alta, uma ação de cada vez.",
    lugares: "Ao passar pela rua, diga o nome de cada lugar no novo idioma.",
    transporte: "Aponte para os veículos que passam e diga o nome.",
    brinquedos: "Na hora de brincar, nomeie cada brinquedo no novo idioma."
  };

  const starsOf = pct => (pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0);
  const starRow = n => "★".repeat(n) + "☆".repeat(3 - n);

  function studyView() {
    const { deck, lang } = cur;
    const l = logOf(lang, deck.key);
    const color = deck.topic ? deck.topic.color : "#f59f00";
    const back = deck.topic ? `#${lang}` : `#${lang}`;
    return `
      <a class="crumb" href="${back}">← Plano de ${esc(LANGS[lang].name)}</a>
      <header class="studyhead" style="--c:${color}">
        <span class="s-i">${deck.icon}</span>
        <div><h1>${esc(deck.title)}</h1><p>${deck.items.length} itens · ${LANGS[lang].flag} ${esc(LANGS[lang].name)} · melhor quiz: <span class="stars">${starRow(l.quiz || 0)}</span></p></div>
        <button type="button" class="btn ghost" data-act="manual" aria-pressed="${!!l.manual}">${isDone(lang, deck.key) ? "✅ Concluída" : "Marcar como concluída"}</button>
      </header>
      <nav class="tabs" role="tablist" aria-label="Atividades">${TABS.map(([k, t]) => `<button type="button" role="tab" class="tab${cur.tab === k ? " on" : ""}" aria-selected="${cur.tab === k}" data-act="tab" data-v="${k}">${t}</button>`).join("")}</nav>
      <section class="panel stage" id="stage"></section>`;
  }

  function stage() {
    const el = $("#stage");
    if (!el) return;
    sayToken++;
    if (cur.tab === "learn") el.innerHTML = learnHTML();
    else if (cur.tab === "memory") startMemory(el);
    else if (cur.tab === "quiz") startQuiz(el);
    else if (cur.tab === "write") startWrite(el, false);
    else if (cur.tab === "dictation") startWrite(el, true);
    else el.innerHTML = videosHTML();
  }

  function learnHTML() {
    const tip = state.mode === "adult" ? "Toque na figura, ouça e repita em voz alta 3 vezes. Use a 🐢 para ouvir bem devagar." : "Toque nas figuras para ouvir! Repita bem alto. 🎤";
    const cards = cur.deck.items.map((it, i) => `
      <div class="fc">
        <button type="button" class="fc-main" data-act="say" data-i="${i}" aria-label="Ouvir ${esc(it.w)}">
          <span class="e">${it.e}</span>
          ${it.l ? `<span class="letter">${esc(it.l)}${esc(it.l.toLowerCase())}</span>` : ""}
          <strong>${esc(it.w)}</strong>${it.t ? `<small>${esc(it.t)}</small>` : ""}
        </button>
        <button type="button" class="slow" data-act="slow" data-i="${i}" aria-label="Ouvir devagar ${esc(it.w)}">🐢</button>
      </div>`).join("");
    return `<div class="stage-top"><p class="tip">${tip}</p><button type="button" class="btn" data-act="sayall">🔊 Ouvir todas</button></div><div class="fc-grid">${cards}</div>`;
  }

  function sayAll() {
    const token = ++sayToken;
    cur.deck.items.forEach((it, i) => setTimeout(() => { if (token === sayToken) speak(it.w, cur.lang, state.mode === "adult"); }, i * 2300));
  }

  /* ---------- Memória ---------- */
  function startMemory(el) {
    const picks = shuffle(cur.deck.items).slice(0, 6);
    const cards = shuffle(picks.flatMap((it, i) => [{ id: i, c: it.e, w: false, it }, { id: i, c: it.w, w: true, it }]));
    mem = { first: null, lock: false, found: 0, pairs: picks.length, moves: 0 };
    el.innerHTML = `<div class="stage-top"><p class="tip">Encontre cada figura e a palavra que combina com ela.</p><span class="score" id="mv">Jogadas: 0</span></div>
      <div class="mem-grid">${cards.map(c => `<button type="button" class="mc${c.w ? " wd" : ""}" data-act="flip" data-id="${c.id}" data-w="${c.w ? 1 : 0}" data-i="${cur.deck.items.indexOf(c.it)}" aria-label="Carta virada para baixo"><span class="q">❓</span><span class="c">${esc(c.c)}</span></button>`).join("")}</div>`;
  }

  function flip(btn) {
    if (!mem || mem.lock || btn.classList.contains("up") || btn.classList.contains("ok")) return;
    btn.classList.add("up");
    if (btn.dataset.w === "1") speak(btn.querySelector(".c").textContent, cur.lang);
    if (!mem.first) { mem.first = btn; return; }
    const a = mem.first;
    mem.first = null;
    mem.moves++;
    $("#mv").textContent = `Jogadas: ${mem.moves}`;
    if (a.dataset.id === btn.dataset.id) {
      a.classList.add("ok"); btn.classList.add("ok");
      if (++mem.found === mem.pairs) {
        setLog(cur.lang, cur.deck.key, { mem: true });
        confetti();
        $("#stage").insertAdjacentHTML("beforeend", `<div class="result"><h2>🎉 Parabéns!</h2><p>Você achou todos os pares em ${mem.moves} jogadas.</p><button type="button" class="btn" data-act="tab" data-v="memory">Jogar de novo</button> <button type="button" class="btn ghost" data-act="tab" data-v="quiz">Ir para o quiz →</button></div>`);
      }
    } else {
      mem.lock = true;
      setTimeout(() => { a.classList.remove("up"); btn.classList.remove("up"); mem.lock = false; }, 1000);
    }
  }

  /* ---------- Quiz ---------- */
  function startQuiz(el) {
    const items = shuffle(cur.deck.items).slice(0, Math.min(8, cur.deck.items.length));
    q = { el, i: 0, score: 0, answered: false, qs: items.map((it, i) => {
      const hear = i % 2 === 1;
      const seen = new Set([hear ? it.e : it.w]);
      const others = shuffle(cur.deck.pool).filter(x => { const k = hear ? x.e : x.w; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
      return { it, hear, opts: shuffle([it, ...others]) };
    }) };
    renderQ();
  }

  function renderQ() {
    const { el, i, qs } = q;
    if (i >= qs.length) return endQuiz();
    const cq = qs[i];
    q.answered = false;
    el.innerHTML = `<div class="qbox"><p class="qcount">Pergunta ${i + 1} de ${qs.length}</p>
      ${cq.hear ? `<button type="button" class="big-say" data-act="qsay">🔊 Ouvir a palavra</button><p class="qask">Qual figura combina com o que você ouviu?</p>`
        : `<div class="q-e">${cq.it.e}</div><p class="qask">Como se diz em ${esc(LANGS[cur.lang].name)}?</p>`}
      <div class="opts${cq.hear ? " emo" : ""}">${cq.opts.map((o, k) => `<button type="button" class="opt" data-act="ans" data-k="${k}">${cq.hear ? o.e : esc(o.w)}</button>`).join("")}</div>
      <div id="fb" aria-live="polite"></div></div>`;
    if (cq.hear) setTimeout(() => speak(cq.it.w, cur.lang, state.mode === "adult"), 300);
  }

  function answer(btn) {
    if (q.answered) return;
    q.answered = true;
    const cq = q.qs[q.i];
    const ok = cq.opts[Number(btn.dataset.k)] === cq.it;
    if (ok) q.score++;
    q.el.querySelectorAll(".opt").forEach((b, k) => { b.disabled = true; if (cq.opts[k] === cq.it) b.classList.add("right"); });
    if (!ok) btn.classList.add("wrong");
    speak(cq.it.w, cur.lang);
    $("#fb").innerHTML = `<p class="${ok ? "good" : "bad"}">${ok ? "✅ Muito bem!" : `❌ Quase! Era: ${cq.it.e} ${esc(cq.it.w)}`}</p><button type="button" class="btn" data-act="qnext">${q.i + 1 === q.qs.length ? "Ver resultado" : "Continuar →"}</button>`;
  }

  function endQuiz() {
    const pct = Math.round(q.score / q.qs.length * 100);
    const s = starsOf(pct);
    const best = Math.max(s, logOf(cur.lang, cur.deck.key).quiz || 0);
    setLog(cur.lang, cur.deck.key, { quiz: best });
    if (s >= 2) confetti();
    const msg = s === 3 ? "Perfeito! Você é demais!" : s === 2 ? "Muito bem! Lição concluída." : "Bom começo! Volte em Aprender e tente de novo.";
    q.el.innerHTML = `<div class="result"><div class="big-stars">${starRow(s)}</div><h2>${q.score} de ${q.qs.length} acertos</h2><p>${msg}</p>
      <button type="button" class="btn" data-act="tab" data-v="quiz">Tentar de novo</button>
      <button type="button" class="btn ghost" data-act="tab" data-v="learn">Rever palavras</button>
      <a class="btn ghost" href="#${cur.lang}">Voltar ao plano</a></div>`;
    refreshHead();
  }

  /* ---------- Escrever ---------- */
  function startWrite(el, dict) {
    wr = { el, dict, list: shuffle(cur.deck.items).slice(0, Math.min(8, cur.deck.items.length)), i: 0, score: 0, hints: 0, checked: false };
    renderW();
  }

  const mask = (w, n) => w.split("").map((c, k) => (c === " " || k < n ? c : "_")).join(" ");

  function renderW() {
    const { el, list, i, dict } = wr;
    if (i >= list.length) {
      setLog(cur.lang, cur.deck.key, dict ? { dict: true } : { write: true });
      if (wr.score / list.length >= 0.7) confetti();
      el.innerHTML = `<div class="result"><h2>${dict ? "🎧" : "✍️"} ${wr.score} de ${list.length} ${dict ? "certas" : "sem dica"}</h2><p>${dict ? "Ouvir e escrever é o ditado das escolas. Continue praticando!" : "Escrever ajuda a memorizar. Continue praticando!"}</p><button type="button" class="btn" data-act="tab" data-v="${cur.tab}">Tentar de novo</button> <a class="btn ghost" href="#${cur.lang}">Voltar ao plano</a></div>`;
      return;
    }
    const it = list[i];
    wr.hints = 0;
    wr.checked = false;
    const prompt = dict
      ? `<div class="q-e">🎧</div><p class="qask">Escute e escreva o que ouviu</p><div class="row"><button type="button" class="btn" data-act="wsay">🔊 Ouvir</button><button type="button" class="btn ghost" data-act="wslow">🐢 Devagar</button></div>`
      : `<div class="q-e">${it.e}</div>${it.t ? `<p class="qask">${esc(it.t)}</p>` : ""}<button type="button" class="btn ghost" data-act="wsay">🔊 Ouvir</button><p class="mask" id="mask">${esc(mask(it.w, 0))}</p>`;
    el.innerHTML = `<form class="qbox" id="wform" autocomplete="off"><p class="qcount">${dict ? "Ditado" : "Palavra"} ${i + 1} de ${list.length}</p>
      ${prompt}
      <input id="wi" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Escreva em ${esc(LANGS[cur.lang].name)}" aria-label="Escreva a palavra">
      <div class="row">${dict ? "" : `<button type="button" class="btn ghost" data-act="whint">💡 Dica</button>`}<button type="submit" class="btn">Verificar</button></div>
      <div id="fb" aria-live="polite"></div></form>`;
    $("#wi").focus();
    if (dict) setTimeout(() => speak(it.w, cur.lang, state.mode === "adult"), 300);
  }

  function checkW() {
    const it = wr.list[wr.i];
    if (wr.checked) { wr.i++; renderW(); return; }
    const ok = norm($("#wi").value) === norm(it.w);
    wr.checked = true;
    if (ok && wr.hints === 0) wr.score++;
    speak(it.w, cur.lang);
    $("#fb").innerHTML = `<p class="${ok ? "good" : "bad"}">${ok ? "✅ Isso mesmo!" : `❌ O certo é: ${esc(it.w)}`}</p>`;
    $("#wform button[type=submit]").textContent = wr.i + 1 === wr.list.length ? "Ver resultado" : "Continuar →";
  }

  /* ---------- Vídeos e dicas ---------- */
  function videosHTML() {
    const topic = cur.deck.topic || { names: { [cur.lang]: "vocabulário" }, perLang: null, rows: [] };
    const links = cur.deck.topic ? resources(cur.lang, cur.deck.topic) : resources(cur.lang, { names: { [cur.lang]: LANGS[cur.lang].name + " vocabulário" }, rows: [`${cur.deck.items[0].e}|${cur.deck.items[0].w}|${cur.deck.items[0].w}|${cur.deck.items[0].w}|${cur.deck.items[0].w}|${cur.deck.items[0].w}`] });
    const tips = state.mode === "adult"
      ? ["Vá devagar: repita cada palavra 3 vezes usando o botão 🐢.", "Estude 10 a 15 minutos por dia, sempre no mesmo horário.", "Errar faz parte! Volte em Aprender e tente de novo.", "Amanhã, revise as palavras de hoje antes das novas."]
      : ["Estude pouco tempo, mas todo dia, e comemore cada estrela! ⭐", "Cante a música do tema junto com o vídeo.", "Brinque de professor: ensine as palavras para alguém da família."];
    if (HOUSE.has(topic.id)) tips.push("Passeie pela casa e aponte para cada objeto dizendo o nome no novo idioma.");
    if (cur.deck.topic && TIPS[cur.deck.topic.id]) tips.push(TIPS[cur.deck.topic.id]);
    return `<div class="res-grid">${links.map(r => `<a class="res" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span class="r-i">${r.ic}</span><strong>${esc(r.label)}</strong><small>${esc(r.note)}</small></a>`).join("")}</div>
      <h3>💡 Dicas de estudo</h3><ul class="tips">${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }

  function refreshHead() {
    const head = $(".studyhead");
    if (head) {
      const tmp = document.createElement("div");
      tmp.innerHTML = studyView();
      head.replaceWith(tmp.querySelector(".studyhead"));
    }
  }

  /* ---------- Roteador e eventos ---------- */
  function render(keepScroll) {
    sayToken++;
    if (hasSpeech()) speechSynthesis.cancel();
    const [lang, id, part] = location.hash.replace(/^#\/?/, "").split("/");
    if (!LANGS[lang]) { cur = null; app.innerHTML = homeView(); document.title = "Plano de Estudos Kids · Polyglot Library"; }
    else if (!id) { cur = null; app.innerHTML = langView(lang); document.title = `Plano de estudos · ${LANGS[lang].full}`; }
    else {
      const deck = getDeck(lang, id, part);
      if (!deck) { location.hash = lang; return; }
      cur = { lang, deck, tab: "learn" };
      app.innerHTML = studyView();
      stage();
      document.title = `${deck.title} · ${LANGS[lang].full}`;
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }

  const hasSpeech = () => "speechSynthesis" in window;

  function applyPrefs() {
    document.body.classList.toggle("big", !!state.big);
    document.body.classList.toggle("mode-adult", state.mode === "adult");
    $("#bigBtn").setAttribute("aria-pressed", !!state.big);
    $("#muteBtn").setAttribute("aria-pressed", !!state.mute);
    $("#muteBtn").textContent = state.mute ? "🔇" : "🔊";
  }

  const ACTIONS = {
    native: b => { state.native = b.dataset.v; save(); render(true); },
    mode: b => { state.mode = b.dataset.v; applyPrefs(); save(); render(true); },
    minutes: b => { state.minutes = Number(b.dataset.v); save(); render(true); },
    tab: b => { cur.tab = b.dataset.v; document.querySelectorAll(".tab").forEach(t => { const on = t.dataset.v === cur.tab; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); }); stage(); },
    say: b => speak(cur.deck.items[b.dataset.i].w, cur.lang),
    slow: b => speak(cur.deck.items[b.dataset.i].w, cur.lang, true),
    sayall: sayAll,
    flip,
    ans: answer,
    qnext: () => { q.i++; renderQ(); },
    qsay: () => speak(q.qs[q.i].it.w, cur.lang, state.mode === "adult"),
    wsay: () => speak(wr.list[wr.i].w, cur.lang, state.mode === "adult"),
    wslow: () => speak(wr.list[wr.i].w, cur.lang, true),
    whint: () => { const w = wr.list[wr.i].w; wr.hints = Math.min(w.length, wr.hints + 1); $("#mask").textContent = mask(w, wr.hints); $("#wi").focus(); },
    manual: () => { const l = logOf(cur.lang, cur.deck.key); setLog(cur.lang, cur.deck.key, { manual: !l.manual }); refreshHead(); toast(!l.manual ? "Lição marcada como concluída ✅" : "Marcação removida"); }
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b);
  });
  document.addEventListener("submit", e => { if (e.target.id === "wform") { e.preventDefault(); checkW(); } });
  $("#bigBtn").addEventListener("click", () => { state.big = !state.big; save(); applyPrefs(); });
  $("#muteBtn").addEventListener("click", () => { state.mute = !state.mute; if (state.mute && hasSpeech()) speechSynthesis.cancel(); save(); applyPrefs(); });
  window.addEventListener("hashchange", () => render(false));

  applyPrefs();
  render(true);
})();
