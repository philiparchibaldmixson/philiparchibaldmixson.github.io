(() => {
  "use strict";

  // Windows has no flag emojis, so flags are real images.
  const flagImg = cc => `<img class="fimg" src="https://flagcdn.com/w80/${cc}.png" srcset="https://flagcdn.com/w160/${cc}.png 2x" alt="" width="40" height="27">`;

  const LANGS = {
    pt: { name: "Português", full: "Português Brasileiro", flag: flagImg("br"), voice: "pt-BR", col: 1, num: 6, kids: "para crianças", song: "música infantil", hello: "Olá!" },
    en: { name: "English", full: "English", flag: flagImg("us"), voice: "en-US", col: 2, num: 7, kids: "for kids", song: "song", hello: "Hello!" },
    es: { name: "Español", full: "Español", flag: flagImg("es"), voice: "es-ES", col: 3, num: 8, kids: "para niños", song: "canción", hello: "¡Hola!" },
    it: { name: "Italiano", full: "Italiano", flag: flagImg("it"), voice: "it-IT", col: 4, num: 9, kids: "per bambini", song: "canzone", hello: "Ciao!" },
    fr: { name: "Français", full: "Français", flag: flagImg("fr"), voice: "fr-FR", col: 5, num: 10, kids: "pour enfants", song: "chanson", hello: "Bonjour !" }
  };

  // Learning order: each group is a block of the study plan.
  const GROUPS = [
    { id: "base", icon: "🌟", title: "Primeiros passos", ids: ["alfabeto", "sons", "numeros", "dezenas", "cores", "formas", "cumprimentos", "pronomes", "perguntas"] },
    { id: "eu", icon: "🧑‍🤝‍🧑", title: "Eu e minha família", ids: ["familia", "corpo", "sentimentos", "roupas", "profissoes", "saude"] },
    { id: "casa", icon: "🏠", title: "Minha casa", ids: ["comodos", "sala", "cozinha", "quarto", "banheiro", "lavanderia", "externa", "churrasqueira", "brinquedos"] },
    { id: "comida", icon: "🍎", title: "Comidas e bebidas", ids: ["frutas", "legumes", "alimentos", "refeicoes"] },
    { id: "natureza", icon: "🌳", title: "Natureza e animais", ids: ["bichos", "selvagens", "mar", "clima", "estacoes"] },
    { id: "tempo", icon: "🗓️", title: "Tempo e datas", ids: ["dias", "meses", "ordinais", "rotina", "feriados"] },
    { id: "cidade", icon: "🚌", title: "Cidade e viagens", ids: ["lugares", "transporte", "direcoes", "uteis"] },
    { id: "escola", icon: "🏫", title: "Escola e ações", ids: ["material", "materias", "frasesaula", "verbos", "essenciais", "opostos"] },
    { id: "rimas", icon: "🎶", title: "Cantigas, rimas e trava-línguas", ids: ["rimas"] }
  ];
  const topics = GROUPS.flatMap(g => g.ids.map(id => {
    const t = (window.PLANO_TOPICS || []).find(x => x.id === id);
    if (t) t.group = g.id;
    return t;
  }).filter(Boolean));

  const STORE = "plano-kids:v1";
  const state = Object.assign({ native: "pt", mode: "kids", minutes: 15, mute: false, big: false, log: {} }, (() => {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (_) { return {}; }
  })());
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) { /* storage unavailable */ } };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function itemsOf(topic, lang) {
    const native = state.native;
    if (topic.perLang) {
      return topic.perLang[lang].map(s => {
        const [e, w] = s.split("|");
        return { e, w, t: "", l: topic.letters ? w.normalize("NFD")[0].toUpperCase() : "" };
      });
    }
    return topic.rows.map(r => {
      const p = r.split("|");
      return { e: p[0], w: p[LANGS[lang].col], t: native !== lang ? p[LANGS[native].col] : "" };
    });
  }

  const perDay = () => {
    const m = state.minutes;
    const n = m <= 10 ? 4 : m <= 15 ? 5 : m <= 20 ? 6 : 8;
    return state.mode === "adult" ? Math.max(3, n - 1) : n;
  };

  function buildPlan(lang) {
    const n = perDay();
    const sessions = [];
    topics.forEach(t => {
      const total = itemsOf(t, lang).length;
      const parts = Math.ceil(total / n);
      for (let p = 0; p < parts; p++) {
        sessions.push({ key: `${t.id}/${p + 1}`, topic: t, part: p + 1, parts, from: p * n, to: Math.min(total, (p + 1) * n) });
      }
    });
    const weeks = [];
    for (let i = 0; i < sessions.length; i += 4) {
      const n2 = weeks.length + 1;
      weeks.push({ n: n2, sessions: sessions.slice(i, i + 4), review: { key: `rev/${n2}` } });
    }
    return { sessions, weeks, perDay: n };
  }

  // A deck is the set of words practiced in one session; "pool" feeds wrong answers.
  function getDeck(lang, id, part) {
    const L = LANGS[lang];
    if (id === "rev") {
      const wk = buildPlan(lang).weeks[Number(part) - 1];
      if (!wk) return null;
      const items = [];
      let pool = [];
      wk.sessions.forEach(s => { const all = itemsOf(s.topic, lang); items.push(...all.slice(s.from, s.to)); pool = pool.concat(all); });
      return { key: `rev/${part}`, title: `Revisão da semana ${part}`, icon: "🏆", items: shuffle(items).slice(0, 10), pool, topic: null, lang: L };
    }
    const topic = topics.find(t => t.id === id);
    if (!topic) return null;
    const all = itemsOf(topic, lang);
    const n = perDay();
    const p = Number(part) || 0;
    const items = p ? all.slice((p - 1) * n, p * n) : all;
    return { key: p ? `${id}/${p}` : `${id}/all`, title: topic.names[lang] + (p ? ` · parte ${p}` : ""), icon: topic.icon, items, pool: all, topic, lang: L };
  }

  const logOf = (lang, key) => state.log[`${lang}/${key}`] || {};
  const isDone = (lang, key) => { const l = logOf(lang, key); return !!(l.manual || (l.quiz || 0) >= 2); };
  function setLog(lang, key, patch) {
    const k = `${lang}/${key}`;
    state.log[k] = Object.assign({}, state.log[k], patch);
    save();
  }

  function resources(lang, topic) {
    const L = LANGS[lang];
    const q = encodeURIComponent;
    const name = topic ? topic.names[lang] : "";
    const first = topic ? itemsOf(topic, lang)[0].w : "";
    const list = [
      { ic: "📺", label: `Vídeos no YouTube`, note: `${name} ${L.kids}`, url: `https://www.youtube.com/results?search_query=${q(`${name} ${L.kids}`)}` },
      { ic: "🎵", label: "Músicas e canções", note: `${name} ${L.song}`, url: `https://www.youtube.com/results?search_query=${q(`${name} ${L.song} ${L.kids}`)}` },
      { ic: "🖼️", label: "Imagens para colorir", note: `${name} colorir`, url: `https://www.google.com/search?tbm=isch&q=${q(`${name} ${L.kids} desenho colorir`)}` },
      { ic: "🗣️", label: "Pronúncia de nativos (Forvo)", note: first, url: `https://forvo.com/search/${q(first)}/${lang}/` },
      { ic: "📖", label: "Dicionário (Wikcionário)", note: name, url: `https://${lang}.wiktionary.org/wiki/Special:Search?search=${q(name)}` },
      { ic: "🃏", label: "Cartões de estudo (Quizlet)", note: `${name} ${L.name}`, url: `https://quizlet.com/search?query=${q(`${name} ${L.name}`)}&type=sets` }
    ];
    const site = KIDS_SITES[lang];
    if (site) list.push({ ic: "🏫", label: site.label, note: "site educativo", url: site.url });
    return list;
  }

  const KIDS_SITES = {
    en: { label: "British Council · LearnEnglish Kids", url: "https://learnenglishkids.britishcouncil.org/" },
    fr: { label: "TV5Monde · Apprendre le français", url: "https://apprendre.tv5monde.com/" },
    es: { label: "RTVE Infantil", url: "https://www.rtve.es/infantil/" },
    it: { label: "RaiPlay Yoyo · bambini", url: "https://www.raiplay.it/bambini" },
    pt: { label: "TV Cultura · infantil", url: "https://cultura.uol.com.br/" }
  };

  let voices = [];
  const hasTTS = "speechSynthesis" in window;
  if (hasTTS) { voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); }; }

  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function speak(text, lang, slow) {
    if (state.mute) return;
    if (!hasTTS) { toast("Seu navegador não tem som de voz."); return; }
    speechSynthesis.cancel();
    const v = LANGS[lang].voice;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v;
    const match = voices.find(x => x.lang.replace("_", "-") === v) || voices.find(x => x.lang.slice(0, 2) === v.slice(0, 2));
    if (match) u.voice = match;
    else if (voices.length) toast(`Sem voz instalada para ${LANGS[lang].name}.`);
    u.rate = slow ? 0.5 : state.mode === "adult" ? 0.7 : 0.85;
    u.pitch = state.mode === "kids" ? 1.15 : 1;
    speechSynthesis.speak(u);
  }

  function confetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    wrap.setAttribute("aria-hidden", "true");
    const bits = ["🎉", "⭐", "✨", "🎈", "🌟", "💖"];
    for (let i = 0; i < 36; i++) {
      const s = document.createElement("span");
      s.textContent = bits[i % bits.length];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDelay = Math.random() * 0.8 + "s";
      s.style.fontSize = 18 + Math.random() * 22 + "px";
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3500);
  }

  window.PK = { LANGS, GROUPS, topics, state, save, esc, norm, shuffle, itemsOf, perDay, buildPlan, getDeck, logOf, isDone, setLog, resources, speak, toast, confetti };
})();
