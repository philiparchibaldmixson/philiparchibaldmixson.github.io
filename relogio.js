(() => {
  "use strict";

  const time = document.getElementById("clockTime");
  const date = document.getElementById("clockDate");
  const zone = document.getElementById("clockZone");
  if (!time || !date) return;

  const tf = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const df = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  let lastDay = "";
  function tick() {
    const now = new Date();
    time.textContent = tf.format(now);
    const day = df.format(now);
    if (day !== lastDay) { lastDay = day; date.textContent = cap(day); }
    setTimeout(tick, 1000 - (now.getTime() % 1000));
  }

  try { zone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " "); } catch (_) { /* zone is optional */ }
  tick();
})();
