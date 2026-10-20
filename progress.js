/* =========================================================
   Progress: personal records, charts, workout details,
   the Progress tab and a small confetti celebration.
   ========================================================= */

/* ---------------- Numbers ---------------- */

// Estimated one-rep max (Epley formula): kg × (1 + reps / 30)
function e1rm(set) {
  const kg = Number(set.kg) || 0;
  const reps = Number(set.reps) || 0;
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

function bestSetOf(sets) {
  return sets.reduce((best, s) => (e1rm(s) > e1rm(best) ? s : best), sets[0]);
}

// One point per workout for an exercise: date + best set
function exerciseHistory(exId, workouts = state.workouts) {
  const out = [];
  for (const w of workouts) {
    const e = w.exercises.find(x => x.exId === exId);
    if (!e || !e.sets.length) continue;
    const best = bestSetOf(e.sets);
    out.push({ date: w.start, best, e1rm: e1rm(best), maxKg: Math.max(...e.sets.map(s => Number(s.kg) || 0)) });
  }
  return out;
}

// Compare a new workout with everything before it
function findPRs(w, previous) {
  const prs = [];
  for (const e of w.exercises) {
    const before = exerciseHistory(e.exId, previous);
    if (!before.length) continue; // first time is not a record
    const best = bestSetOf(e.sets);
    const oldBest = Math.max(...before.map(h => h.e1rm));
    const oldMaxKg = Math.max(...before.map(h => h.maxKg));
    const newMaxKg = Math.max(...e.sets.map(s => Number(s.kg) || 0));
    if (newMaxKg > oldMaxKg) prs.push({ exId: e.exId, type: "Heaviest weight", kg: newMaxKg, reps: e.sets.find(s => Number(s.kg) === newMaxKg).reps });
    else if (e1rm(best) > oldBest + 0.01) prs.push({ exId: e.exId, type: "Best set", kg: best.kg, reps: best.reps });
  }
  return prs;
}

function fmtKg(n) {
  return Math.round(n).toLocaleString("en-GB");
}

/* ---------------- Charts (simple SVG) ---------------- */

function lineChartSVG(points, unit = "kg") {
  if (points.length < 2) {
    return `<div class="chart-empty">Log this exercise in two workouts to see a graph.</div>`;
  }
  const W = 320, H = 150, P = 22;
  const ys = points.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 1) { max += 1; min -= 1; }
  const x = i => P + (i / (points.length - 1)) * (W - P * 2);
  const y = v => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)} ${H - P} L${x(0)} ${H - P} Z`;
  const last = points[points.length - 1];
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/>
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      <line x1="${P}" x2="${W - P}" y1="${y(max)}" y2="${y(max)}" class="grid"/>
      <line x1="${P}" x2="${W - P}" y1="${y(min)}" y2="${y(min)}" class="grid"/>
      <text x="${P}" y="${y(max) - 6}" class="axis">${fmtKg(max)} ${unit}</text>
      <text x="${P}" y="${y(min) + 14}" class="axis">${fmtKg(min)} ${unit}</text>
      <path d="${area}" fill="url(#area)"/>
      <path d="${line}" class="line"/>
      ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="${i === points.length - 1 ? 5 : 3}" class="dot"/>`).join("")}
      <text x="${x(points.length - 1)}" y="${y(last.y) - 10}" text-anchor="end" class="value">${fmtKg(last.y)} ${unit}</text>
    </svg>`;
}

function barChartSVG(bars) {
  const W = 320, H = 150, P = 20, gap = 10;
  const max = Math.max(1, ...bars.map(b => b.v));
  const bw = (W - P * 2 - gap * (bars.length - 1)) / bars.length;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}">
      ${bars.map((b, i) => {
        const h = Math.max(3, (b.v / max) * (H - 50));
        const x = P + i * (bw + gap);
        return `
          <rect x="${x}" y="${H - 24 - h}" width="${bw}" height="${h}" rx="6" class="${i === bars.length - 1 ? "bar now" : "bar"}" style="animation-delay:${i * 40}ms"/>
          <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis">${b.label}</text>
          ${b.v ? `<text x="${x + bw / 2}" y="${H - 30 - h}" text-anchor="middle" class="axis small">${b.short}</text>` : ""}`;
      }).join("")}
    </svg>`;
}

/* ---------------- Exercise progress (inside the exercise sheet) ---------------- */

function exerciseProgressHTML(exId) {
  const hist = exerciseHistory(exId);
  if (!hist.length) return "";
  const best = hist.reduce((a, h) => (h.e1rm > a.e1rm ? h : a), hist[0]);
  const heaviest = Math.max(...hist.map(h => h.maxKg));
  return `
    <div class="section-title">Your progress</div>
    <div class="card">
      <div class="chart-title">Estimated 1 rep max</div>
      ${lineChartSVG(hist.map(h => ({ y: h.e1rm })))}
    </div>
    <div class="stat-row">
      <div class="stat"><b>${fmtKg(heaviest)} kg</b><span>Heaviest</span></div>
      <div class="stat"><b>${esc(best.best.kg)}×${esc(best.best.reps)}</b><span>Best set</span></div>
      <div class="stat"><b>${hist.length}</b><span>Workouts</span></div>
    </div>`;
}

/* ---------------- Workout detail (tap a workout in History) ---------------- */

function openWorkoutDetail(id) {
  const w = state.workouts.find(x => x.id === id);
  if (!w) return;
  const prIds = new Set((w.prs || []).map(p => p.exId));
  openSheet(`
    <div class="sheet-head">
      <div><h2>${esc(w.name)}</h2><div class="muted small">${formatDate(w.start)} · ${new Date(w.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div></div>
      <button class="link" data-action="close-sheet">Close</button>
    </div>
    <div class="stat-row">
      <div class="stat"><b>${shortDuration(w.end - w.start)}</b><span>Duration</span></div>
      <div class="stat"><b>${fmtKg(workoutVolume(w))}</b><span>Total kg</span></div>
      <div class="stat"><b>${doneSets(w)}</b><span>Sets</span></div>
    </div>
    ${(w.prs || []).length ? `<div class="pr-box">${w.prs.map(prLineHTML).join("")}</div>` : ""}
    <div class="section-title">Muscles worked</div>
    <div class="card">${muscleSectionHTML([w])}</div>
    <div class="section-title">Exercises</div>
    ${w.exercises.map(e => {
      const ex = EX_BY_ID[e.exId];
      return `
        <div class="card detail-ex">
          <div class="ex-head">
            <div class="thumb"><img src="${img(ex)}" alt=""></div>
            <div class="head-info"><div class="name">${esc(ex?.name)}</div>
            ${prIds.has(e.exId) ? `<span class="pr-badge">🏆 PR</span>` : ""}</div>
          </div>
          ${e.sets.map((s, i) => `<div class="set-line"><span>Set ${i + 1}</span><b>${esc(s.kg || 0)} kg × ${esc(s.reps || 0)}</b></div>`).join("")}
        </div>`;
    }).join("")}
    <button class="btn btn-ghost" data-action="delete-workout" data-id="${esc(w.id)}">Delete Workout</button>
  `);
}

function prLineHTML(p) {
  const ex = EX_BY_ID[p.exId];
  return `<div class="pr-line"><span class="trophy">🏆</span><div><b>${esc(ex?.name)}</b><div class="muted small">${esc(p.type)}: ${esc(p.kg)} kg × ${esc(p.reps)}</div></div></div>`;
}

/* ---------------- Progress tab ---------------- */

function weekStart(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function progressHTML() {
  const ws = state.workouts;
  const now = weekStart(Date.now());
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - i * 7 * 864e5;
    const inWeek = ws.filter(w => weekStart(w.start) === start);
    const v = inWeek.reduce((n, w) => n + workoutVolume(w), 0);
    weeks.push({
      v,
      label: new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "numeric" }),
      short: v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}`
    });
  }
  const last7 = ws.filter(w => w.start > Date.now() - 7 * 864e5);
  const totalKg = ws.reduce((n, w) => n + workoutVolume(w), 0);
  const allPRs = ws.flatMap(w => (w.prs || []).map(p => ({ ...p, date: w.start }))).reverse();

  // Exercises you have done, most recent first
  const seen = new Set(); const done = [];
  for (const w of ws.slice().reverse()) for (const e of w.exercises) {
    if (!seen.has(e.exId) && EX_BY_ID[e.exId]) { seen.add(e.exId); done.push(e.exId); }
  }

  return `
    <div class="page">
      <h1 class="large-title">Progress</h1>
      <div class="stat-row">
        <div class="stat"><b>${ws.length}</b><span>Workouts</span></div>
        <div class="stat"><b>${totalKg >= 10000 ? (totalKg / 1000).toFixed(1) + "t" : fmtKg(totalKg)}</b><span>Total ${totalKg >= 10000 ? "tonnes" : "kg"}</span></div>
        <div class="stat"><b>${allPRs.length}</b><span>Records</span></div>
      </div>

      <div class="section-title">Volume per week</div>
      <div class="card">${barChartSVG(weeks)}</div>

      <div class="section-title">Muscles · last 7 days</div>
      <div class="card">${last7.length ? muscleSectionHTML(last7) : `<div class="chart-empty">No workouts in the last 7 days.</div>`}</div>

      ${allPRs.length ? `<div class="section-title">Personal records</div>
        <div class="card pr-list">${allPRs.slice(0, 6).map(prLineHTML).join("")}</div>` : ""}

      ${done.length ? `<div class="section-title">Your exercises</div>
        <div class="list">${done.map(id => {
          const ex = EX_BY_ID[id]; const h = exerciseHistory(id); const last = h[h.length - 1];
          return `<button class="row" data-action="exercise-info" data-id="${esc(id)}">
            <div class="thumb"><img src="${img(ex)}" alt="" loading="lazy"></div>
            <div class="info"><div class="title">${esc(ex.name)}</div>
            <div class="sub" style="text-transform:none">${h.length} ${h.length === 1 ? "workout" : "workouts"} · last ${esc(last.best.kg)} kg × ${esc(last.best.reps)}</div></div>
            <span class="chev">›</span></button>`;
        }).join("")}</div>` : ""}

      ${ws.length < 3 ? `
        <div class="card demo-card">
          <b>Want to see how it looks?</b>
          <p class="muted">Add a few example workouts from the last weeks.</p>
          <button class="btn btn-secondary" data-action="demo-data">Add sample workouts</button>
        </div>` : ""}

      ${ws.length ? `<button class="btn btn-ghost" data-action="reset-data">Delete all data</button>` : ""}
    </div>`;
}

/* ---------------- Sample data for demos ---------------- */

function addSampleWorkouts() {
  const plans = [
    { name: "Push Day", ex: [["bench-press", 80, 8], ["incline-dumbbell-press", 26, 10], ["seated-military-press", 40, 8], ["triceps-pushdown-with-cable", 30, 12]] },
    { name: "Pull Day", ex: [["barbell-dead-lifts", 120, 5], ["pull-ups", 0, 8], ["seated-cable-rows", 55, 10], ["biceps-curls-with-barbell", 30, 10]] },
    { name: "Leg Day", ex: [["barbell-squat", 90, 6], ["romanian-dead-lift", 80, 8], ["leg-press", 160, 10], ["standing-calf-raises-using-machine", 60, 12]] }
  ];
  const day = 864e5;
  const start = Date.now() - 34 * day;
  const made = [];
  for (let i = 0; i < 12; i++) {
    const plan = plans[i % 3];
    const round = Math.floor(i / 3);
    const t = start + i * 2.8 * day + 17 * 3600e3;
    const w = {
      id: uid(), name: plan.name, start: t, end: t + (48 + (i % 4) * 6) * 60e3,
      exercises: plan.ex.map(([exId, kg, reps]) => ({
        exId,
        sets: [0, 1, 2].map(j => ({
          kg: String(kg ? kg + round * (kg >= 60 ? 2.5 : 1) : 0),
          reps: String(Math.max(1, reps - (j === 2 ? 1 : 0) + (round % 2))),
          done: true
        }))
      }))
    };
    w.prs = findPRs(w, made);
    made.push(w);
  }
  state.workouts = [...made, ...state.workouts].sort((a, b) => a.start - b.start);
  save();
}

/* ---------------- Confetti ---------------- */

function confetti() {
  const screen = document.querySelector(".screen");
  const box = document.createElement("div");
  box.className = "confetti";
  const colors = ["#3d8bff", "#ffd60a", "#ff453a", "#30d158", "#ff9f0a", "#bf5af2"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * .4 + "s";
    p.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    p.style.setProperty("--x", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    box.appendChild(p);
  }
  screen.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}
