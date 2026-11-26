(() => {
  "use strict";

  const { $, esc, fmt, countUp } = window.MX;
  const LESSONS = window.COURSE_FILES || [];
  const BASE = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  const PAGES = ["index.html", "plano-estudos.html"];
  const encodePath = p => p.split("/").map(encodeURIComponent).join("/");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const goat = ((window.ANALYTICS || {}).goatcounter || "").trim();

  const EXTERNAL = [
    { name: "Google Fonts (estilos)", kind: "reach", url: "https://fonts.googleapis.com/css2?family=Inter" },
    { name: "Google Fonts (arquivos de fonte)", kind: "reach", url: "https://fonts.gstatic.com/" },
    { name: "Bandeiras (flagcdn)", kind: "img", url: "https://flagcdn.com/w80/br.png" },
    { name: "YouTube", kind: "reach", url: "https://www.youtube.com/robots.txt" },
    { name: "GitHub (API de publicações)", kind: "reach", url: "https://api.github.com/" },
    { name: "PBS Kids", kind: "reach", url: "https://pbskids.org/" },
    { name: "Lumni (França)", kind: "reach", url: "https://www.lumni.fr/" },
    { name: "RaiPlay Bambini (Itália)", kind: "reach", url: "https://www.raiplay.it/bambini" },
    { name: "RTVE Infantil (Espanha)", kind: "reach", url: "https://www.rtve.es/infantil/" },
    { name: "TV5Monde (França)", kind: "reach", url: "https://apprendre.tv5monde.com/" },
    { name: "TV Cultura (Brasil)", kind: "reach", url: "https://cultura.uol.com.br/" }
  ];
  if (goat) EXTERNAL.splice(3, 0, { name: "GoatCounter (script de contagem)", kind: "reach", url: "https://gc.zgo.at/count.js" });

  const GROUPS = [
    { id: "pages", icon: "🖥️", title: "Páginas do site", hint: "Abre cada página de verdade e confere se ela montou." },
    { id: "core", icon: "📦", title: "Arquivos do site", hint: "Estilos, scripts, dados e ícone usados pelas páginas." },
    { id: "lessons", icon: "📚", title: "Aulas de gramática", hint: "Uma resposta para cada aula do curso." },
    { id: "ext", icon: "🌐", title: "Serviços externos", hint: "Fontes, bandeiras, vídeos e sites educativos. Se cair, o site continua funcionando." }
  ];

  let run = null;
  const ui = {
    hero: $("#statusHero"), title: $("#statusTitle"), sub: $("#statusSub"), meta: $("#statusMeta"),
    btn: $("#runBtn"), ring: $("#ring"), ringFg: $("#ringFg"), ringNum: $("#ringNum"), groups: $("#groups"),
    kpis: $("#kpis"), perf: $("#perfBody"), perfNote: $("#perfNote"), chkNote: $("#chkNote")
  };
  const CIRC = 2 * Math.PI * 52;
  ui.ringFg.style.strokeDasharray = CIRC;

  /* ---------- Sondas ---------- */
  async function probeOnce(url, method, timeout) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    const t0 = performance.now();
    try {
      const r = await fetch(url, { method, cache: "no-store", signal: ctl.signal });
      const bytes = method === "GET" ? (await r.blob()).size : Number(r.headers.get("content-length")) || 0;
      return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), bytes, lm: r.headers.get("last-modified") };
    } catch (e) {
      return { ok: false, status: 0, ms: Math.round(performance.now() - t0), bytes: 0, error: e.name === "AbortError" ? "tempo esgotado" : "falha de rede" };
    } finally { clearTimeout(timer); }
  }

  // Hospedagens compartilhadas às vezes derrubam conexões: só acusa erro depois de tentar de novo.
  async function probe(url, method = "GET", timeout = 20000, retries = 2) {
    let r, tries = 0;
    for (; tries <= retries; tries++) {
      r = await probeOnce(url, method, timeout);
      if (r.status || r.error === "tempo esgotado") break;
      await sleep(500 * (tries + 1));
    }
    r.tries = Math.min(tries, retries) + 1;
    if (r.ok && r.tries > 1) run.retried++;
    return r;
  }

  async function reach(url, timeout = 12000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    const t0 = performance.now();
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: ctl.signal });
      return { ok: true, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, ms: Math.round(performance.now() - t0), error: e.name === "AbortError" ? "tempo esgotado" : "sem resposta" };
    } finally { clearTimeout(timer); }
  }

  function image(url, timeout = 12000) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const img = new Image();
      const done = ok => resolve({ ok, ms: Math.round(performance.now() - t0), error: ok ? "" : "imagem não carregou" });
      const timer = setTimeout(() => done(false), timeout);
      img.onload = () => { clearTimeout(timer); done(true); };
      img.onerror = () => { clearTimeout(timer); done(false); };
      img.src = `${url}?mx=${Date.now()}`;
    });
  }

  async function pool(items, limit, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const k = i++; await fn(items[k], k); }
    }));
  }

  /* ---------- Teste de renderização (iframe) ---------- */
  function frameTest(page, inspect) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const f = document.createElement("iframe");
      f.setAttribute("aria-hidden", "true");
      f.tabIndex = -1;
      f.style.cssText = "position:fixed;left:-9999px;top:0;width:1280px;height:900px;border:0;visibility:hidden";
      const finish = r => { f.remove(); resolve(r); };
      const timer = setTimeout(() => finish({ loadMs: 0, checks: [{ name: "Carregamento", ok: false, detail: "tempo esgotado" }] }), 25000);
      f.onload = async () => {
        const loadMs = Math.round(performance.now() - t0);
        await sleep(1800);
        clearTimeout(timer);
        try { finish({ loadMs, checks: inspect(f.contentWindow, f.contentDocument) }); }
        catch (e) { finish({ loadMs, checks: [{ name: "Inspeção da página", ok: false, detail: e.message }] }); }
      };
      f.src = `${BASE}${page}?mx=${Date.now()}`;
      document.body.appendChild(f);
    });
  }

  const imagesOk = doc => {
    const imgs = [...doc.images];
    const bad = imgs.filter(i => !(i.complete && i.naturalWidth > 0));
    return { ok: bad.length === 0, detail: `${imgs.length - bad.length} de ${imgs.length} imagens carregadas` };
  };

  const inspectIndex = (win, doc) => {
    const out = [];
    const cards = doc.querySelectorAll("#cards .card").length;
    out.push({ name: "Cartões dos 5 idiomas", ok: cards === 5, detail: `${cards} de 5` });
    const lessons = doc.querySelectorAll(".lesson").length;
    out.push({ name: "Lista de aulas montada", ok: lessons === LESSONS.length, detail: `${fmt(lessons)} de ${fmt(LESSONS.length)} aulas na tela` });
    const kb = doc.querySelector(".kids-banner");
    out.push({ name: "Estilos aplicados", ok: !!kb && win.getComputedStyle(kb).display === "flex", detail: kb ? "CSS carregado" : "banner não encontrado" });
    const sp = doc.querySelectorAll("#sponsorStrip .sp").length;
    out.push({ name: "Faixa de patrocinadores", ok: sp > 0, detail: `${sp} espaços` });
    const clock = (doc.getElementById("clockTime") || {}).textContent || "";
    out.push({ name: "Relógio funcionando", ok: /\d\d:\d\d:\d\d/.test(clock), detail: clock || "vazio" });
    const im = imagesOk(doc);
    out.push({ name: "Imagens", ok: im.ok, detail: im.detail });
    return out;
  };

  const inspectPlano = (win, doc) => {
    const out = [];
    const PK = win.PK;
    out.push({ name: "Motor do plano carregado", ok: !!PK, detail: PK ? "ok" : "window.PK ausente" });
    if (!PK) return out;
    const langs = doc.querySelectorAll("#app .lang-card").length;
    out.push({ name: "Cartões dos 5 idiomas", ok: langs === 5, detail: `${langs} de 5` });
    const topics = win.PLANO_TOPICS || [];
    const grouped = PK.topics.length;
    out.push({ name: "Todos os temas nos grupos", ok: grouped === topics.length && grouped > 0, detail: `${grouped} de ${topics.length} temas` });
    let bad = 0, items = 0;
    topics.forEach(t => {
      if (t.perLang) { Object.values(t.perLang).forEach(a => { items += a.length; a.forEach(s => { if (s.split("|").length !== 2) bad++; }); }); return; }
      t.rows.forEach(r => { items++; const p = r.split("|"); if (p.length !== 6 || p.some(x => !x.trim())) bad++; });
    });
    out.push({ name: "Vocabulário sem linhas quebradas", ok: bad === 0, detail: bad ? `${bad} linhas com problema` : `${fmt(items)} itens verificados` });
    const missing = ["pt", "en", "es", "it", "fr"].filter(k => topics.some(t => !t.names || !t.names[k]));
    out.push({ name: "Títulos nos 5 idiomas", ok: missing.length === 0, detail: missing.length ? `faltam: ${missing.join(", ")}` : "completo" });
    out.push({ name: "Métodos de cada país", ok: Object.keys(win.PLANO_METHODS || {}).length === 5, detail: `${Object.keys(win.PLANO_METHODS || {}).length} de 5 países` });
    const flags = [...doc.querySelectorAll(".fimg")];
    const okFlags = flags.filter(i => i.complete && i.naturalWidth > 0).length;
    out.push({ name: "Bandeiras", ok: flags.length > 0 && okFlags === flags.length, detail: `${okFlags} de ${flags.length}` });
    run.kids = { topics: PK.topics.length, groups: PK.GROUPS.length, items };
    return out;
  };

  /* ---------- Estado e interface ---------- */
  function newRun() {
    return { total: 4 + LESSONS.length + EXTERNAL.length + 10, done: 0, rows: { pages: [], core: [], ext: [] }, retried: 0, files: [],
      lessons: { total: LESSONS.length, ok: 0, fail: [], ms: [], bytes: 0 }, timings: [], started: Date.now(), kids: null, loadMs: {} };
  }

  const stateOf = r => (r.ok ? "ok" : "fail");
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };

  function paintRing() {
    let pct = Math.min(100, Math.round(run.done / run.total * 100));
    if (run.finished) {
      const s = summary();
      pct = s.totalChecks ? Math.floor(s.passed / s.totalChecks * 100) : 0;
    }
    ui.ringFg.style.strokeDashoffset = CIRC * (1 - pct / 100);
    ui.ringNum.textContent = pct + "%";
    ui.ring.setAttribute("aria-label", run.finished ? `${pct}% das verificações aprovadas` : `Verificação em andamento: ${pct}%`);
  }

  function rowHTML(r) {
    const s = r.state || stateOf(r);
    const meta = [r.ms != null ? `${r.ms} ms` : "", r.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : "", r.status && !r.ok ? `HTTP ${r.status}` : ""].filter(Boolean).join(" · ");
    return `<li data-s="${s}"><span class="dot" aria-hidden="true"></span><div><b>${esc(r.name)}</b>${r.detail || r.error ? `<small>${esc(r.detail || r.error)}</small>` : ""}</div><span class="ms">${esc(meta)}</span></li>`;
  }

  function groupHTML(g) {
    let list = "", ok = 0, total = 0, fail = 0, warn = 0;
    if (g.id === "lessons") {
      const L = run.lessons;
      ok = L.ok; total = L.total; fail = L.fail.length;
      const pct = total ? Math.round((ok + fail) / total * 100) : 0;
      list = `<div class="lbar"><i style="width:${pct}%"></i></div><p class="lcount"><b>${fmt(ok)}</b> de ${fmt(total)} aulas respondendo${fail ? ` · <span class="bad">${fmt(fail)} com problema</span>` : ""}</p>`;
      if (fail) list += `<ul class="chk-list fails">${L.fail.slice(0, 40).map(f => rowHTML({ name: f.name, error: f.error || `HTTP ${f.status}`, ok: false })).join("")}</ul>${fail > 40 ? `<p class="lcount">…e mais ${fail - 40}.</p>` : ""}`;
    } else {
      const rows = run.rows[g.id];
      total = g.id === "pages" ? rows.length : g.id === "ext" ? EXTERNAL.length : rows.length;
      rows.forEach(r => { if (r.ok) ok++; else if (g.id === "ext") warn++; else fail++; });
      list = `<ul class="chk-list">${rows.map(r => rowHTML(g.id === "ext" && !r.ok ? { ...r, state: "warn" } : r)).join("")}</ul>`;
    }
    const st = fail ? "fail" : warn ? "warn" : (total && ok === total ? "ok" : "run");
    return `<article class="group" data-s="${st}"><header><span class="g-i" aria-hidden="true">${g.icon}</span><div><h3>${g.title}</h3><small>${g.hint}</small></div><span class="g-count">${fmt(ok)}/${fmt(total)}</span></header>${list}</article>`;
  }

  function paint() {
    paintRing();
    ui.groups.innerHTML = GROUPS.map(groupHTML).join("");
  }

  /* ---------- Execução ---------- */
  const tick = () => { run.done++; schedule(); };

  async function discover() {
    const found = new Set(PAGES);
    for (const p of PAGES) {
      const res = await fetch(`${BASE}${p}?mx=${Date.now()}`, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) continue;
      const html = await res.text();
      for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        const u = m[1];
        if (/^(?:[a-z]+:|\/\/)/i.test(u) || !/\.(?:js|css|svg|png|ico|html)$/i.test(u)) continue;
        found.add(u.replace(/^\.\//, ""));
      }
    }
    return [...found];
  }

  async function execute() {
    run = newRun();
    paint();

    const files = await discover();
    run.total = 4 + files.length + LESSONS.length + EXTERNAL.length;
    schedule();

    await pool(files, 4, async f => {
      const r = await probe(`${BASE}${encodePath(f)}?mx=${Date.now()}`);
      run.rows.core.push({ name: f, ok: r.ok, status: r.status, ms: r.ms, bytes: r.bytes, error: r.error });
      if (r.ok && r.lm) run.files.push({ name: f, lm: new Date(r.lm) });
      run.timings.push({ name: f, ms: r.ms });
      run.coreBytes = (run.coreBytes || 0) + (r.bytes || 0);
      tick();
    });
    run.rows.core.sort((a, b) => a.name.localeCompare(b.name));

    for (const [page, inspect] of [["index.html", inspectIndex], ["plano-estudos.html", inspectPlano]]) {
      const res = await frameTest(page, inspect);
      run.loadMs[page] = res.loadMs;
      res.checks.forEach(c => run.rows.pages.push({ ...c, name: `${page} · ${c.name}`, ms: null }));
      run.done += 2;
      schedule();
    }

    await pool(LESSONS, 4, async f => {
      const r = await probe(`${BASE}${encodePath(f)}`, "HEAD", 20000);
      if (r.ok) { run.lessons.ok++; run.lessons.ms.push(r.ms); run.lessons.bytes += r.bytes; }
      else run.lessons.fail.push({ name: f.split("/").slice(-1)[0], status: r.status, error: r.error });
      run.timings.push({ name: f.split("/").slice(-1)[0], ms: r.ms });
      tick();
    });

    await pool(EXTERNAL, 4, async e => {
      const r = e.kind === "img" ? await image(e.url) : await reach(e.url);
      run.rows.ext.push({ name: e.name, ok: r.ok, ms: r.ms, error: r.error, detail: r.ok ? "alcançável" : "" });
      tick();
    });
    run.rows.ext.sort((a, b) => EXTERNAL.findIndex(x => x.name === a.name) - EXTERNAL.findIndex(x => x.name === b.name));
  }

  /* ---------- Resultado ---------- */
  function summary() {
    const all = [...run.rows.pages, ...run.rows.core];
    const critFail = all.filter(r => !r.ok).length + run.lessons.fail.length;
    const extFail = run.rows.ext.filter(r => !r.ok).length;
    const passed = all.length - all.filter(r => !r.ok).length + run.lessons.ok + run.rows.ext.length - extFail;
    const totalChecks = all.length + run.lessons.total + run.rows.ext.length;
    return { critFail, extFail, passed, totalChecks };
  }

  function updates() {
    const box = $("#siteUpd");
    const list = run.files.filter(f => !isNaN(f.lm)).sort((a, b) => b.lm - a.lm);
    if (!list.length) { box.innerHTML = `<h3>No ar em ${esc(location.hostname)}</h3><p class="loading">O servidor não informou a data dos arquivos.</p>`; return; }
    const when = d => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    $("#pubNote").textContent = `No ar: atualizado ${window.MX.ago(list[0].lm.toISOString())}`;
    box.innerHTML = `<h3>No ar em ${esc(location.hostname)}</h3>
      <p class="upd-main"><strong>${when(list[0].lm)}</strong><span>data do arquivo mais recente no servidor</span></p>
      <ul class="plist upd">${list.slice(0, 6).map(f => `<li><div><b>${esc(f.name)}</b></div><code>${when(f.lm)}</code></li>`).join("")}</ul>`;
  }

  function finish() {
    const s = summary();
    const state = s.critFail ? "fail" : s.extFail ? "warn" : "ok";
    ui.hero.dataset.state = state;
    ui.title.textContent = state === "ok" ? "Tudo funcionando" : state === "warn" ? "Funcionando, com avisos" : "Problemas encontrados";
    ui.sub.textContent = state === "ok"
      ? `${fmt(s.passed)} de ${fmt(s.totalChecks)} verificações passaram: páginas, arquivos, aulas e serviços externos.`
      : state === "warn"
        ? `O site está no ar, mas ${s.extFail} serviço(s) externo(s) não responderam. Isso não derruba o site.`
        : `${fmt(s.critFail)} item(ns) do próprio site falharam. Veja os detalhes em vermelho abaixo.`;
    ui.meta.textContent = `Última verificação: ${new Date().toLocaleTimeString("pt-BR")} · levou ${((Date.now() - run.started) / 1000).toFixed(1)} s`;
    ui.chkNote.textContent = `${fmt(s.passed)} de ${fmt(s.totalChecks)} ok`;
    run.done = run.total;
    run.finished = true;
    paint();
    kpis(s);
    perf();
    updates();
  }

  function kpis(s) {
    const per = {};
    LESSONS.forEach(f => { const n = parseInt(f, 10); per[n] = (per[n] || 0) + 1; });
    const k = run.kids || {};
    const avg = run.timings.length ? Math.round(run.timings.reduce((a, b) => a + b.ms, 0) / run.timings.length) : 0;
    const items = [
      [LESSONS.length, "Aulas de gramática", "📚"], [5, "Idiomas", "🌍"], [k.topics || 0, "Temas do Plano Kids", "🧸"],
      [k.items || 0, "Itens de vocabulário", "🔤"], [s.passed, `Verificações ok de ${fmt(s.totalChecks)}`, "✅"], [avg, "Resposta média (ms)", "⚡"]
    ];
    ui.kpis.innerHTML = items.map(([n, l, ic]) => `<div class="kpi"><span class="k-i" aria-hidden="true">${ic}</span><strong data-to="${n}">0</strong><span>${esc(l)}</span></div>`).join("");
    ui.kpis.querySelectorAll("[data-to]").forEach(el => countUp(el, +el.dataset.to));
  }

  const grade = ms => (ms < 600 ? "ok" : ms < 1800 ? "warn" : "fail");

  function perf() {
    const t = run.timings.filter(x => x.ms > 0);
    const avg = t.length ? Math.round(t.reduce((a, b) => a + b.ms, 0) / t.length) : 0;
    const sorted = [...t].sort((a, b) => a.ms - b.ms);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].ms : 0;
    const slow = [...t].sort((a, b) => b.ms - a.ms).slice(0, 6);
    const max = Math.max(1, ...slow.map(x => x.ms));
    const cards = [
      ["Resposta média", `${avg} ms`, grade(avg)], ["95% respondem em até", `${p95} ms`, grade(p95)],
      ["Peso dos arquivos do site", `${((run.coreBytes || 0) / 1024).toFixed(0)} KB`, (run.coreBytes || 0) < 1.5e6 ? "ok" : "warn"],
      ["Conexões que precisaram de nova tentativa", fmt(run.retried), run.retried === 0 ? "ok" : run.retried < 30 ? "warn" : "fail"],
      ["Página inicial pronta em", `${((run.loadMs["index.html"] || 0) / 1000).toFixed(1)} s`, grade(run.loadMs["index.html"] || 0)],
      ["Plano Kids pronto em", `${((run.loadMs["plano-estudos.html"] || 0) / 1000).toFixed(1)} s`, grade(run.loadMs["plano-estudos.html"] || 0)]
    ].map(([l, v, g]) => `<div class="pc" data-s="${g}"><strong>${v}</strong><span>${l}</span></div>`).join("");
    ui.perf.innerHTML = `<div class="perf-cards">${cards}</div>
      <div class="card"><h3>Arquivos mais lentos nesta verificação</h3><ul class="plist slow">${slow.map(x => `<li><div><b>${esc(x.name)}</b></div><div class="pbar"><i style="width:${Math.round(x.ms / max * 100)}%"></i></div><strong>${x.ms} ms</strong></li>`).join("")}</ul></div>`;
    ui.perfNote.textContent = `${fmt(t.length)} arquivos medidos`;
  }

  /* ---------- Controle ---------- */
  async function start() {
    if (ui.btn.disabled) return;
    if (location.protocol === "file:") {
      ui.hero.dataset.state = "warn";
      ui.title.textContent = "Abra pelo site publicado";
      ui.sub.textContent = "Navegadores bloqueiam os testes quando a página é aberta como arquivo local. Acesse o painel pelo endereço do site (github.io).";
      ui.btn.disabled = true;
      return;
    }
    ui.btn.disabled = true;
    ui.btn.textContent = "Verificando…";
    ui.hero.dataset.state = "running";
    ui.title.textContent = "Verificando…";
    ui.sub.textContent = "Testando páginas, arquivos, aulas e serviços externos. As aulas são conferidas com calma, para não sobrecarregar o servidor.";
    ui.meta.textContent = "";
    ui.perf.innerHTML = ""; ui.kpis.innerHTML = "";
    try { await execute(); finish(); }
    catch (e) {
      ui.hero.dataset.state = "fail";
      ui.title.textContent = "A verificação não terminou";
      ui.sub.textContent = e.message;
    }
    ui.btn.disabled = false;
    ui.btn.textContent = "↻ Verificar agora";
  }

  ui.btn.addEventListener("click", start);
  start();
})();
