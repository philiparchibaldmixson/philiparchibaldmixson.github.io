(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("pt-BR");
  const fmt = n => nf.format(n);
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

  function countUp(el, to) {
    const start = performance.now();
    const step = now => {
      const t = Math.min((now - start) / 900, 1);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.MX = { $, esc, fmt, pad, ymd, daysAgo, countUp };

  /* ---------- Tema (mesma chave do site) ---------- */
  const root = document.documentElement;
  const KEY = "polyglot-library:theme";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) root.dataset.theme = saved;
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
  } catch (_) { /* storage unavailable */ }
  $("#themeBtn").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (_) { /* ignore */ }
  });
  const bar = $("#topbar");
  const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Botão "não contar meus acessos" ---------- */
  const skipBtn = $("#skipBtn");
  const skipState = $("#skipState");
  const readSkip = () => { try { return !!localStorage.getItem("skipgc"); } catch (_) { return false; } };
  const paintSkip = () => {
    const on = readSkip();
    skipBtn.textContent = on ? "Voltar a contar meus acessos" : "Não contar meus acessos neste navegador";
    skipState.textContent = on ? "✅ Seus acessos não estão sendo contados neste navegador." : "";
  };
  skipBtn.addEventListener("click", () => {
    try { readSkip() ? localStorage.removeItem("skipgc") : localStorage.setItem("skipgc", "t"); } catch (_) { /* ignore */ }
    paintSkip();
  });
  paintSkip();

  /* ---------- Audiência (GoatCounter) ---------- */
  const code = ((window.ANALYTICS || {}).goatcounter || "").trim();
  const audBody = $("#audBody");
  const audNote = $("#audNote");

  function setup() {
    audNote.textContent = "Não configurada";
    audBody.innerHTML = `<div class="setup">
      <div class="setup-text">
        <h3>Ative a contagem de visitantes em 3 passos</h3>
        <p>O seu site é feito só de arquivos (sem banco de dados nem programa rodando no servidor), então a contagem usa o GoatCounter: gratuito, leve e sem cookies.</p>
        <ol>
          <li>Crie a conta grátis em <a href="https://www.goatcounter.com/signup" target="_blank" rel="noopener noreferrer">goatcounter.com/signup</a> e escolha um código (ex.: <code>lingua-academy</code>). Quando ele pedir o endereço do site, informe <code>linguaacademy.com.br</code>.</li>
          <li>No painel dele, abra <b>Settings</b> e ative <b>“Allow adding visitor counts on your website”</b>.</li>
          <li>Escreva o código em <code>analytics-config.js</code>, envie o arquivo para a hospedagem, e esta seção passa a mostrar seus números.</li>
        </ol>
      </div>
      <div class="setup-preview" aria-hidden="true">
        <div class="mini"><i style="height:35%"></i><i style="height:55%"></i><i style="height:42%"></i><i style="height:70%"></i><i style="height:58%"></i><i style="height:88%"></i><i style="height:76%"></i></div>
        <span>Seus números aparecerão aqui</span>
      </div></div>
      <p class="online-note">👀 <b>Visitantes online agora:</b> o GoatCounter não oferece essa contagem em tempo real para páginas públicas. Para isso seria preciso um servidor próprio.</p>`;
  }

  async function gcCount(path, range = {}) {
    const q = new URLSearchParams();
    if (range.start) q.set("start", range.start);
    if (range.end) q.set("end", range.end);
    const qs = q.toString();
    const url = `https://${code}.goatcounter.com/counter/${encodeURIComponent(path)}.json${qs ? "?" + qs : ""}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 404) return 0;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return parseInt(String(j.count).replace(/\D/g, ""), 10) || 0;
  }

  async function audience() {
    if (!code) return setup();
    audNote.textContent = "Carregando…";
    audBody.innerHTML = `<p class="loading">Buscando números no GoatCounter…</p>`;
    try {
      const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));
      const [total, d30, series, home, plano] = await Promise.all([
        gcCount("TOTAL"),
        gcCount("TOTAL", { start: ymd(daysAgo(29)), end: ymd(new Date()) }),
        Promise.all(days.map(d => gcCount("TOTAL", { start: ymd(d), end: ymd(d) }))),
        gcCount("/"),
        gcCount("/plano-estudos.html")
      ]);
      const today = series[series.length - 1];
      const d7 = series.slice(-7).reduce((a, b) => a + b, 0);
      const max = Math.max(1, ...series);
      const cards = [["Total de acessos", total], ["Hoje", today], ["Últimos 7 dias", d7], ["Últimos 30 dias", d30]]
        .map(([l, n]) => `<div class="kpi"><strong data-to="${n}">0</strong><span>${l}</span></div>`).join("");
      const bars = series.map((n, i) => {
        const d = days[i];
        return `<div class="bar" title="${pad(d.getDate())}/${pad(d.getMonth() + 1)}: ${fmt(n)} acessos"><i style="height:${Math.max(4, Math.round(n / max * 100))}%"></i><small>${pad(d.getDate())}</small></div>`;
      }).join("");
      const pages = [["Página inicial", "/", home], ["Plano de estudos Kids", "/plano-estudos.html", plano]];
      const pmax = Math.max(1, ...pages.map(p => p[2]));
      const rows = pages.map(([name, path, n]) => `<li><div><b>${esc(name)}</b><code>${esc(path)}</code></div><div class="pbar"><i style="width:${Math.round(n / pmax * 100)}%"></i></div><strong>${fmt(n)}</strong></li>`).join("");
      audNote.textContent = `GoatCounter · ${code}`;
      audBody.innerHTML = `<div class="kpis kpis-4">${cards}</div>
        <div class="aud-grid">
          <div class="card"><h3>Acessos por dia · últimos 14 dias</h3><div class="chart">${bars}</div></div>
          <div class="card"><h3>Páginas mais vistas</h3><ul class="plist">${rows}</ul></div>
        </div>
        <p class="online-note">⏱️ Os números são atualizados pelo GoatCounter a cada poucas horas. Para ver os acessos em detalhe (países, navegadores, origem), abra o <a href="https://${esc(code)}.goatcounter.com" target="_blank" rel="noopener noreferrer">painel completo</a>.</p>`;
      audBody.querySelectorAll("[data-to]").forEach(el => countUp(el, +el.dataset.to));
    } catch (e) {
      audNote.textContent = "Erro";
      audBody.innerHTML = `<div class="warn-box"><b>Não foi possível ler os números.</b> (${esc(e.message)})<br>Confira se o código <code>${esc(code)}</code> está certo e se a opção <b>“Allow adding visitor counts on your website”</b> está ativa no GoatCounter. Bloqueadores de anúncio também podem impedir a leitura.</div>`;
    }
  }

  /* ---------- Últimas publicações (GitHub) ---------- */
  const OWNER = "philiparchibaldmixson";
  const REPO = "philiparchibaldmixson.github.io";
  const ago = iso => {
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
    if (s < 86400) return `há ${Math.round(s / 3600)} h`;
    return `há ${Math.round(s / 86400)} dia(s)`;
  };
  async function commits() {
    const ol = $("#commits");
    try {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=6`, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = await r.json();
      ol.innerHTML = list.map(c => `<li>
        <span class="sha">${esc(c.sha.slice(0, 7))}</span>
        <div><b>${esc(c.commit.message.split("\n")[0])}</b><small>${esc(c.commit.author.name)} · ${ago(c.commit.author.date)}</small></div>
        <a href="${esc(c.html_url)}" target="_blank" rel="noopener noreferrer">ver →</a></li>`).join("");
      $("#ghNote").textContent = `última ${ago(list[0].commit.author.date)}`;
    } catch (e) {
      $("#ghNote").textContent = "indisponível";
      ol.innerHTML = `<li class="warn-li">Não foi possível consultar o GitHub agora (${esc(e.message)}). O limite de consultas pode ter sido atingido; tente de novo mais tarde.</li>`;
    }
  }

  window.MX.ago = ago;
  audience();
  commits();
})();
