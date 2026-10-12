(() => {
  "use strict";

  const FILES = window.COURSE_FILES || [];

  // Per-language presentation, keyed by the numeric prefix of the top-level folder.
  const LANGS = {
    6:  { code: "PT", name: "Português Brasileiro", hello: "Olá",     sub: "Curso de Português",  levels: ["Básico", "Intermediário", "Avançado"],  c: ["#19c37d", "#e6b800"] },
    7:  { code: "EN", name: "English",              hello: "Hello",   sub: "Grammar Course",      levels: ["Basic", "Intermediate", "Advanced"],    c: ["#3a86ff", "#ff6b6b"] },
    8:  { code: "ES", name: "Español",              hello: "Hola",    sub: "Curso de Español",    levels: ["Básico", "Intermedio", "Avanzado"],     c: ["#ff5a4d", "#ffb400"] },
    9:  { code: "IT", name: "Italiano",             hello: "Ciao",    sub: "Corso d'Italiano",    levels: ["Basico", "Intermedio", "Avanzato"],     c: ["#1fb76a", "#ff4d5a"] },
    10: { code: "FR", name: "Français",             hello: "Bonjour", sub: "Cours de Français",   levels: ["Basique", "Intermédiaire", "Avancé"],   c: ["#7b5cff", "#ff5fa2"] }
  };

  const ACRONYMS = new Set(["js", "vt", "vi", "ss", "sc", "etc"]);
  const SEEN_KEY = "polyglot-library:seen";

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const href = p => p.split("/").map(encodeURIComponent).join("/");
  const prefixNum = s => { const m = /^(\d+)\s*-\s*/.exec(s); return m ? parseInt(m[1], 10) : null; };
  const stripPrefix = s => s.replace(/^\d+\s*-\s*/, "");

  function prettify(raw) {
    const lower = stripPrefix(raw).replace(/\.html$/i, "").toLocaleLowerCase();
    const cased = lower.replace(/[\p{L}]+/gu, w => ACRONYMS.has(w) ? w.toUpperCase() : w);
    return cased.charAt(0).toLocaleUpperCase() + cased.slice(1);
  }

  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch (_) { /* storage unavailable */ }
  const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch (_) { /* ignore */ } };

  // Build the data model: language -> level -> { loose: [], groups: Map }
  const courses = new Map();
  const everything = [];
  const groupKeys = new Set();

  for (const path of FILES) {
    const seg = path.split("/");
    const langNum = prefixNum(seg[0]);
    const meta = LANGS[langNum];
    if (!meta) continue;
    const levelNum = prefixNum(seg[1]) || 1;
    const hasGroup = seg.length >= 5;
    const groupRaw = hasGroup ? seg[3] : null;
    const file = seg[seg.length - 1];

    const lesson = {
      path,
      langNum,
      levelNum,
      num: prefixNum(file),
      title: prettify(file),
      group: groupRaw ? prettify(groupRaw) : "",
      where: `${meta.name} · ${meta.levels[levelNum - 1] || ""}${groupRaw ? " · " + prettify(groupRaw) : ""}`
    };
    lesson.haystack = norm(`${lesson.title} ${lesson.group} ${meta.name} ${meta.levels[levelNum - 1] || ""} ${lesson.num ?? ""}`);
    everything.push(lesson);

    if (!courses.has(langNum)) courses.set(langNum, new Map());
    const levels = courses.get(langNum);
    if (!levels.has(levelNum)) levels.set(levelNum, { loose: [], groups: new Map() });
    const bucket = levels.get(levelNum);
    if (groupRaw) {
      groupKeys.add(`${langNum}/${levelNum}/${groupRaw}`);
      if (!bucket.groups.has(groupRaw)) bucket.groups.set(groupRaw, { num: prefixNum(groupRaw), title: prettify(groupRaw), items: [] });
      bucket.groups.get(groupRaw).items.push(lesson);
    } else {
      bucket.loose.push(lesson);
    }
  }

  const langOrder = [...courses.keys()].sort((a, b) => a - b);

  // Markup helpers
  const accent = m => `--a1:${m.c[0]};--a2:${m.c[1]};--c1:${m.c[0]};--c2:${m.c[1]}`;

  function lessonHTML(l, showWhere) {
    const m = LANGS[l.langNum];
    const num = l.num === null ? "•" : String(l.num).padStart(3, "0");
    return `<a class="lesson${seen.has(l.path) ? " seen" : ""}" href="${esc(href(l.path))}" data-path="${esc(l.path)}" style="${accent(m)}" title="${esc(stripPrefix(l.path.split("/").pop()))}">
      <span class="num">${num}</span>
      <span class="name">${esc(l.title)}${showWhere ? `<span class="where">${esc(l.where)}</span>` : ""}</span>
      <span class="tick" aria-hidden="true"></span>
      <svg class="arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>`;
  }

  const countLevel = b => b.loose.length + [...b.groups.values()].reduce((n, g) => n + g.items.length, 0);

  function panelHTML(bucket) {
    let html = "";
    if (bucket.loose.length) html += `<div class="grid loose">${bucket.loose.map(l => lessonHTML(l)).join("")}</div>`;
    for (const g of bucket.groups.values()) {
      const n = g.num === null ? "+" : String(g.num).padStart(2, "0");
      html += `<details class="group"><summary><span class="n">${n}</span><span class="t">${esc(g.title)}</span><span class="c">${g.items.length} ${g.items.length === 1 ? "lesson" : "lessons"}</span></summary><div class="grid">${g.items.map(l => lessonHTML(l)).join("")}</div></details>`;
    }
    return html;
  }

  function courseHTML(langNum) {
    const m = LANGS[langNum];
    const levels = courses.get(langNum);
    const levelNums = [...levels.keys()].sort((a, b) => a - b);
    const total = [...levels.values()].reduce((n, b) => n + countLevel(b), 0);

    const tabs = levelNums.map((n, i) => `<button class="tab" role="tab" type="button" aria-selected="${i === 0}" data-level="${n}">${esc(m.levels[n - 1] || "Level " + n)}<small>${countLevel(levels.get(n))}</small></button>`).join("");
    const panels = levelNums.map((n, i) => `<div class="panel" role="tabpanel" data-level="${n}" ${i === 0 ? "" : "hidden"}>${panelHTML(levels.get(n))}</div>`).join("");

    return `<section class="course" id="lang-${langNum}" data-lang="${langNum}" style="${accent(m)}">
      <div class="course-head">
        <div class="course-title"><span class="code">${m.code}</span><div><h2>${esc(m.name)}</h2><p>${esc(m.sub)} · ${total} lessons</p></div></div>
        <div class="tabs" role="tablist" aria-label="${esc(m.name)} levels">${tabs}</div>
      </div>
      ${panels}
    </section>`;
  }

  function progress(langNum) {
    const list = everything.filter(l => l.langNum === langNum);
    const done = list.filter(l => seen.has(l.path)).length;
    return { done, total: list.length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
  }

  function renderCards() {
    $("#cards").innerHTML = langOrder.map(n => {
      const m = LANGS[n];
      const p = progress(n);
      return `<a class="card" href="#lang-${n}" style="${accent(m)}">
        <span class="code">${m.code}</span>
        <h3>${esc(m.name)}</h3>
        <span class="hello">${esc(m.hello)}!</span>
        <span class="meta">${p.total} lessons · ${p.done} visited</span>
        <span class="bar"><i style="width:${p.pct}%"></i></span>
      </a>`;
    }).join("");
  }

  function renderChips() {
    $("#chips").innerHTML = langOrder.map(n => `<a class="chip" href="#lang-${n}" data-lang="${n}" style="${accent(LANGS[n])}">${esc(LANGS[n].name.split(" ")[0])}</a>`).join("");
  }

  function renderStats() {
    const levelCount = [...courses.values()].reduce((n, l) => n + l.size, 0);
    const items = [[everything.length, "Lessons"], [langOrder.length, "Languages"], [levelCount, "Levels"], [groupKeys.size, "Topic groups"]];
    $("#stats").innerHTML = items.map(([n, label]) => `<div class="stat"><strong data-to="${n}">0</strong><span>${label}</span></div>`).join("");
    document.querySelectorAll(".stat strong").forEach(el => {
      const to = +el.dataset.to;
      const start = performance.now();
      const tick = now => {
        const t = Math.min((now - start) / 1100, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function renderCourses() {
    $("#courses").innerHTML = langOrder.map(courseHTML).join("");
  }

  // Tabs
  $("#courses").addEventListener("click", e => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    const course = tab.closest(".course");
    course.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t === tab));
    course.querySelectorAll(".panel").forEach(p => { p.hidden = p.dataset.level !== tab.dataset.level; });
  });

  // Remember visited lessons
  const markSeen = e => {
    const a = e.target.closest(".lesson");
    if (!a) return;
    seen.add(a.dataset.path);
    a.classList.add("seen");
    saveSeen();
  };
  document.addEventListener("click", markSeen);
  document.addEventListener("auxclick", markSeen);
  window.addEventListener("pageshow", () => { renderCards(); });

  // Search
  const results = $("#results");
  const search = $("#search");
  let timer;

  function runSearch() {
    const q = norm(search.value.trim());
    const searching = q.length > 0;
    $("#cards").hidden = searching;
    $("#courses").hidden = searching;
    results.hidden = !searching;
    if (!searching) return;

    const terms = q.split(/\s+/);
    const hits = everything.filter(l => terms.every(t => l.haystack.includes(t)));
    const shown = hits.slice(0, 300);
    results.innerHTML = `<h2>Search results</h2>
      <p class="count">${hits.length} ${hits.length === 1 ? "lesson" : "lessons"} found${hits.length > shown.length ? ` (showing first ${shown.length})` : ""}</p>
      ${hits.length ? `<div class="grid">${shown.map(l => lessonHTML(l, true)).join("")}</div>` : `<p class="empty">No lessons match “${esc(search.value.trim())}”.</p>`}`;
  }

  search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 120); });
  document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); search.focus(); }
    if (e.key === "Escape" && document.activeElement === search) { search.value = ""; runSearch(); search.blur(); }
  });

  // Theme
  const root = document.documentElement;
  const savedTheme = (() => { try { return localStorage.getItem("polyglot-library:theme"); } catch (_) { return null; } })();
  if (savedTheme) root.dataset.theme = savedTheme;
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
  $("#themeBtn").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("polyglot-library:theme", root.dataset.theme); } catch (_) { /* ignore */ }
  });

  // Greeting rotation
  const greetings = Object.values(LANGS).map(l => l.hello);
  const greetEl = $("#greeting");
  let gi = 0;
  setInterval(() => {
    greetEl.classList.add("out");
    setTimeout(() => {
      gi = (gi + 1) % greetings.length;
      greetEl.textContent = greetings[gi];
      greetEl.classList.remove("out");
    }, 350);
  }, 2400);

  // Floating letters
  const letters = "àáâãçéêíñóôõúüìòùœæßÀÉÇÑ¿¡«»ABCabc";
  const glyphs = $("#glyphs");
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("span");
    s.textContent = letters[Math.floor(Math.random() * letters.length)];
    s.style.left = Math.random() * 100 + "%";
    s.style.fontSize = 28 + Math.random() * 70 + "px";
    s.style.animationDuration = 22 + Math.random() * 28 + "s";
    s.style.animationDelay = -Math.random() * 40 + "s";
    glyphs.appendChild(s);
  }

  // Topbar shadow and active language chip
  const topbar = $("#topbar");
  const onScroll = () => topbar.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function observeCourses() {
    const chips = new Map([...document.querySelectorAll(".chip")].map(c => [c.dataset.lang, c]));
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        chips.forEach(c => c.classList.remove("active"));
        const chip = chips.get(en.target.dataset.lang);
        if (chip) {
          chip.classList.add("active");
          const bar = chip.parentElement;
          bar.scrollLeft = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
        }
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".course").forEach(c => io.observe(c));
  }

  renderChips();
  renderStats();
  renderCards();
  renderCourses();
  observeCourses();
})();
