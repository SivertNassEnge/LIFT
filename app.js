/* =========================================================
   Lift – a simple workout tracker that runs in the browser.
   All data is stored locally in the browser (localStorage).
   Exercise data and drawings: Everkinetic (CC BY-SA 4.0)
   https://github.com/everkinetic/data
   ========================================================= */

const IMG_BASE = "https://raw.githubusercontent.com/everkinetic/data/master/dist/svg/";
const STORE_KEY = "lift.v2";

// Exercises shown first when you are not searching
const POPULAR = [
  "bench-press", "barbell-squat", "barbell-dead-lifts", "incline-bench-press",
  "bench-press-dumbbell", "incline-dumbbell-press", "seated-military-press",
  "one-arm-dumbbell-shoulder-press", "lateral-dumbbell-raises", "pull-ups",
  "wide-grip-chin-up", "underhand-pull-down", "seated-cable-rows",
  "reverse-grips-bent-over-barbell-rows", "t-bar-rows", "romanian-dead-lift",
  "leg-press", "hack-squat-machine", "leg-extensions", "lying-leg-curl-machine",
  "seated-leg-curl", "barbell-lunges", "walking-lunges",
  "standing-calf-raises-using-machine", "biceps-curls-with-barbell",
  "biceps-curl-with-dumbbell", "biceps-hammer-curl-with-dumbbell",
  "triceps-pushdown-with-cable", "triceps-pushdown-with-rope-and-cable", "chest-dips",
  "tricep-dips-using-body-weight", "cable-crossover", "dumbbell-flys", "push-ups",
  "barbell-shrugs", "hyperextensions", "crunches"
];

// Muscle filter chips -> muscles in the database
const GROUPS = {
  All: null,
  Chest: ["chest"],
  Back: ["lats", "upper back", "lower back", "traps"],
  Shoulders: ["shoulders"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Legs: ["quads", "hamstrings", "calves", "abductors"],
  Glutes: ["glutes"],
  Abs: ["abs", "obliques"]
};

/* ---------------- State ---------------- */

let EXERCISES = [];
let EX_BY_ID = {};
let state = load();
let currentTab = "workout";
let timerHandle = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage not available */ }
  return { workouts: [], active: null, theme: "graphite" };
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ---------------- Helpers ---------------- */

const $ = (sel, el = document) => el.querySelector(sel);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function img(ex, i = 0) {
  return ex && ex.img[i] ? IMG_BASE + ex.img[i] : "";
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function shortDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1 min";
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 1800);
}

// Total volume (kg x reps) for completed sets in a workout
function workoutVolume(w) {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) {
    if (s.done) v += (Number(s.kg) || 0) * (Number(s.reps) || 0);
  }
  return Math.round(v);
}

function doneSets(w) {
  return w.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
}

// The sets from the last finished workout that included this exercise
function previousSets(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const e = state.workouts[i].exercises.find(x => x.exId === exId);
    if (e) {
      const sets = e.sets.filter(s => s.done);
      if (sets.length) return sets;
    }
  }
  return [];
}

// Make the instructions short: first sentence of the first 3 steps
function simpleSteps(ex) {
  return ex.ins
    .filter(t => !/^(repeat|return to)/i.test(t.trim()))
    .slice(0, 3)
    .map(t => {
      let s = t.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
      s = s.split(/(?<=[.!?])\s/)[0];
      s = s.replace(/[,.]?\s*this (will be|is) your starting position\.?/i, ".").trim();
      if (!/[.!?]$/.test(s)) s += ".";
      return s;
    });
}

/* ---------------- Icons ---------------- */

const ICON = {
  search: '<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-1-5h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M12.3 3a9 9 0 1 0 8.7 11.3A7 7 0 0 1 12.3 3z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>'
};

/* ---------------- Tabs ---------------- */

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  render();
  $("#scroller").scrollTo({ top: 0 });
}

function render() {
  clearInterval(timerHandle);
  const view = $("#view");
  if (currentTab === "workout") view.innerHTML = state.active ? activeWorkoutHTML() : startHTML();
  if (currentTab === "exercises") view.innerHTML = exercisesPageHTML();
  if (currentTab === "history") view.innerHTML = historyHTML();
  if (currentTab === "progress") view.innerHTML = progressHTML();
  if (currentTab === "workout" && state.active) startTimer();
  if (currentTab === "exercises") renderExerciseList($("#ex-page-list"), "", "All", openExerciseInfo);
}

/* ---------------- Workout tab: start screen ---------------- */

function startHTML() {
  const last = state.workouts.slice(-3).reverse();
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = state.workouts.filter(w => w.start > weekAgo).length;
  return `
    <div class="page">
      <div class="title-row">
        <h1 class="large-title">Workout</h1>
        <button class="round-btn press" data-action="theme" aria-label="Change theme">${state.theme === "sand" ? ICON.moon : ICON.sun}</button>
      </div>
      <div class="hero">
        <h2>Ready to lift?</h2>
        <p>Start an empty workout and add exercises as you go.</p>
        <button class="btn btn-primary" data-action="start">Start Workout</button>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${thisWeek}</b><span>This week</span></div>
        <div class="stat"><b>${state.workouts.length}</b><span>Total workouts</span></div>
      </div>
      ${last.length ? `<div class="section-title">Recent</div>${last.map(workoutCardHTML).join("")}` : ""}
    </div>`;
}

function workoutCardHTML(w) {
  const names = w.exercises.map(e => EX_BY_ID[e.exId]?.name).filter(Boolean);
  return `
    <button class="card w-item press" data-action="open-workout" data-id="${esc(w.id)}">
      <div class="w-top"><h3>${esc(w.name || "Workout")}</h3>${(w.prs || []).length ? `<span class="pr-badge">🏆 ${w.prs.length} PR</span>` : ""}</div>
      <div class="meta">${formatDate(w.start)} · ${shortDuration(w.end - w.start)} · ${workoutVolume(w).toLocaleString("en-GB")} kg</div>
      <div class="chips">${names.slice(0, 4).map(n => `<span class="chip static">${esc(n)}</span>`).join("")}
        ${names.length > 4 ? `<span class="chip static">+${names.length - 4}</span>` : ""}</div>
    </button>`;
}

/* ---------------- Workout tab: active workout ---------------- */

function startWorkout() {
  const hour = new Date().getHours();
  const name = hour < 11 ? "Morning Workout" : hour < 17 ? "Afternoon Workout" : "Evening Workout";
  state.active = { id: uid(), name, start: Date.now(), exercises: [] };
  save();
  render();
}

function activeWorkoutHTML() {
  const w = state.active;
  return `
    <div class="page">
      <div class="topbar">
        <div class="timer"><span id="timer">${formatDuration(Date.now() - w.start)}</span><small id="live-stats">${liveStatsText()}</small></div>
        <button class="btn btn-primary btn-small" data-action="finish">Finish</button>
      </div>
      <div id="ex-cards">${w.exercises.map((e, i) => exerciseCardHTML(e, i)).join("")}</div>
      ${w.exercises.length ? "" : `<div class="empty">No exercises yet.<br>Add your first one below.</div>`}
      <div style="margin-top:16px"><button class="btn btn-secondary" data-action="add-exercise">+ Add Exercise</button></div>
      <button class="btn btn-ghost" data-action="discard">Discard Workout</button>
    </div>`;
}

function exerciseCardHTML(e, i) {
  const ex = EX_BY_ID[e.exId];
  const prev = previousSets(e.exId);
  return `
    <div class="card ex-card" data-ex="${i}">
      <div class="ex-head">
        <div class="thumb"><img src="${img(ex)}" alt="" loading="lazy"></div>
        <div class="head-info">
          <div class="name">${esc(ex?.name)}</div>
          <button class="pill press" data-action="howto" data-id="${esc(e.exId)}">ⓘ How to</button>
        </div>
        <button class="icon-btn press" data-action="remove-ex" aria-label="Remove">${ICON.close}</button>
      </div>
      <table class="sets">
        <thead><tr><th>Set</th><th>kg</th><th>Reps</th><th></th></tr></thead>
        <tbody>${e.sets.map((s, j) => setRowHTML(s, j, prev[j])).join("")}</tbody>
      </table>
      <button class="add-set press" data-action="add-set">+ Add Set</button>
      ${prev.length ? `<div class="prev-hint">Grey numbers = what you lifted last time</div>` : ""}
    </div>`;
}

function setRowHTML(s, j, p) {
  return `
    <tr class="set-row ${s.done ? "done" : ""}" data-set="${j}">
      <td class="set-no">${j + 1}</td>
      <td><input class="num" inputmode="decimal" data-field="kg" value="${esc(s.kg)}" placeholder="${p ? esc(p.kg) : "–"}"></td>
      <td><input class="num" inputmode="numeric" data-field="reps" value="${esc(s.reps)}" placeholder="${p ? esc(p.reps) : "–"}"></td>
      <td><button class="check" data-action="toggle-set" aria-label="Done">${ICON.check}</button></td>
    </tr>`;
}

function addExerciseToWorkout(exId) {
  const prev = previousSets(exId);
  const count = Math.max(prev.length, 1);
  state.active.exercises.push({
    exId,
    sets: Array.from({ length: count }, () => ({ kg: "", reps: "", done: false }))
  });
  save();
  render();
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll(".ex-card");
    cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function startTimer() {
  timerHandle = setInterval(() => {
    const t = $("#timer");
    if (t && state.active) t.textContent = formatDuration(Date.now() - state.active.start);
  }, 1000);
}

// A set counts if it is checked, or if reps are filled in
function isLogged(s) {
  return s.done || String(s.reps).trim() !== "";
}

function loggedSetCount(w) {
  return w.exercises.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);
}

function liveStatsText() {
  const w = state.active;
  if (!w) return "";
  const sets = doneSets(w);
  return `${workoutVolume(w).toLocaleString("en-GB")} kg · ${sets} ${sets === 1 ? "set" : "sets"}`;
}

function updateLiveStats() {
  const el = $("#live-stats");
  if (el) el.textContent = liveStatsText();
}

// Step 1: ask for a title before saving
function finishWorkout() {
  const w = state.active;
  if (!loggedSetCount(w)) {
    toast("Log kg and reps for at least one set first");
    return;
  }
  // Preview of what will be saved
  const preview = {
    exercises: w.exercises.map(e => ({ sets: e.sets.filter(isLogged).map(s => ({ ...s, done: true })) }))
  };
  const unchecked = w.exercises.reduce((n, e) => n + e.sets.filter(s => !s.done && isLogged(s)).length, 0);
  openSheet(`
    <div class="sheet-head">
      <h2>Finish Workout</h2>
      <button class="link" data-action="close-sheet">Back</button>
    </div>
    <label class="field-label" for="w-title">Workout title</label>
    <input id="w-title" class="text-input" maxlength="40" value="${esc(w.name)}" placeholder="e.g. Push Day">
    <div class="stat-row">
      <div class="stat"><b>${shortDuration(Date.now() - w.start)}</b><span>Duration</span></div>
      <div class="stat"><b>${workoutVolume(preview).toLocaleString("en-GB")}</b><span>Total kg</span></div>
      <div class="stat"><b>${doneSets(preview)}</b><span>Sets</span></div>
    </div>
    ${unchecked ? `<p class="note">${unchecked} filled ${unchecked === 1 ? "set is" : "sets are"} not checked, but will be saved too.</p>` : ""}
    <div style="margin-top:20px"><button class="btn btn-primary" data-action="save-workout">Save Workout</button></div>
  `);
  setTimeout(() => $("#w-title")?.select(), 450);
}

// Step 2: save and show the summary
function saveWorkout() {
  const w = state.active;
  const title = ($("#w-title")?.value || "").trim();
  w.name = title || w.name;
  w.exercises = w.exercises
    .map(e => ({ exId: e.exId, sets: e.sets.filter(isLogged).map(s => ({ kg: s.kg, reps: s.reps, done: true })) }))
    .filter(e => e.sets.length);
  w.end = Date.now();
  w.prs = findPRs(w, state.workouts);
  state.workouts.push(w);
  state.active = null;
  save();
  closeSheet();
  render();
  setTimeout(() => openSummary(w), 320);
}

/* ---------------- Summary after a workout ---------------- */

function openSummary(w) {
  const prs = w.prs || [];
  openSheet(`
    <div class="summary-hero">
      <div class="big">${prs.length ? "🏆" : "💪"}</div>
      <h2>${esc(w.name)}</h2>
      <div class="muted">${prs.length ? `New personal record${prs.length > 1 ? "s" : ""}!` : "Workout saved"} · ${formatDate(w.start)}</div>
    </div>
    <div class="stat-row">
      <div class="stat"><b>${shortDuration(w.end - w.start)}</b><span>Duration</span></div>
      <div class="stat"><b>${workoutVolume(w).toLocaleString("en-GB")}</b><span>Total kg</span></div>
      <div class="stat"><b>${doneSets(w)}</b><span>Sets</span></div>
    </div>
    ${prs.length ? `<div class="pr-box">${prs.map(prLineHTML).join("")}</div>` : ""}
    <div class="section-title">Muscles worked</div>
    <div class="card">${muscleSectionHTML([w])}</div>
    <div class="section-title">Exercises</div>
    <div class="list">${w.exercises.map(e => {
      const ex = EX_BY_ID[e.exId];
      const best = bestSetOf(e.sets);
      return `<div class="row"><div class="thumb"><img src="${img(ex)}" alt=""></div>
        <div class="info"><div class="title">${esc(ex?.name)}</div>
        <div class="sub" style="text-transform:none">${e.sets.length} sets · best ${esc(best.kg || 0)} kg × ${esc(best.reps || 0)}</div></div></div>`;
    }).join("")}</div>
    <div style="margin-top:20px"><button class="btn btn-primary" data-action="close-sheet">Done</button></div>
  `);
  if (prs.length) setTimeout(confetti, 350);
}

/* ---------------- Exercise list (search + filter) ---------------- */

function exercisesPageHTML() {
  return `
    <div class="page">
      <h1 class="large-title">Exercises</h1>
      <div id="ex-page-list"></div>
      <p class="credit">Exercise drawings and data: Everkinetic (CC BY-SA 4.0)</p>
    </div>`;
}

// Renders search, filter chips and the list into a container
function renderExerciseList(container, query, group, onPick) {
  container.innerHTML = `
    <div class="search">${ICON.search}<input type="search" placeholder="Search exercises" value="${esc(query)}"></div>
    <div class="chips">${Object.keys(GROUPS).map(g => `<button class="chip ${g === group ? "on" : ""}" data-group="${g}">${g}</button>`).join("")}</div>
    <div class="list"></div>`;

  const listEl = $(".list", container);
  const input = $("input", container);
  let q = query, g = group;

  function draw() {
    const muscles = GROUPS[g];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let items = EXERCISES.filter(ex =>
      (!muscles || ex.p.some(m => muscles.includes(m))) &&
      words.every(w => ex.name.toLowerCase().includes(w))
    );
    // Popular exercises first
    const rank = id => { const i = POPULAR.indexOf(id); return i === -1 ? 999 : i; };
    items.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
    items = items.slice(0, 80);

    listEl.innerHTML = items.length ? items.map(ex => `
      <button class="row" data-id="${esc(ex.id)}">
        <div class="thumb"><img src="${img(ex)}" alt="" loading="lazy"></div>
        <div class="info"><div class="title">${esc(ex.name)}</div>
        <div class="sub">${esc(ex.p.join(", "))} · ${esc(ex.eq)}</div></div>
        <span class="chev">›</span>
      </button>`).join("") : `<div class="empty">No exercises found</div>`;
  }

  input.addEventListener("input", () => { q = input.value; draw(); });
  container.addEventListener("click", ev => {
    const chip = ev.target.closest("[data-group]");
    if (chip) {
      g = chip.dataset.group;
      container.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === chip));
      draw();
      return;
    }
    const row = ev.target.closest(".row[data-id]");
    if (row) onPick(row.dataset.id);
  });
  draw();
}

function openExercisePicker() {
  openSheet(`
    <div class="sheet-head">
      <h2>Add Exercise</h2>
      <button class="link" data-action="close-sheet">Cancel</button>
    </div>
    <div id="picker"></div>`, true);
  renderExerciseList($("#picker"), "", "All", id => {
    closeSheet();
    addExerciseToWorkout(id);
  });
}

/* ---------------- How to / exercise info ---------------- */

function howToHTML(ex) {
  return `
    <div class="sheet-head">
      <h2>${esc(ex.name)}</h2>
      <button class="link" data-action="close-sheet">Close</button>
    </div>
    <div class="demo" id="demo">
      <img src="${img(ex, 0)}" alt="Start position">
      ${ex.img[1] ? `<img src="${img(ex, 1)}" alt="End position" class="hide">` : ""}
    </div>
    <ol class="steps">${simpleSteps(ex).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="section-title">Muscles</div>
    <div class="muscles">
      ${ex.p.map(m => `<span class="tag primary">${esc(m)}</span>`).join("")}
      ${ex.s.map(m => `<span class="tag secondary">${esc(m)}</span>`).join("")}
    </div>`;
}

function openHowTo(id) {
  const ex = EX_BY_ID[id];
  if (!ex) return;
  openSheet(howToHTML(ex));
  animateDemo();
}

function openExerciseInfo(id) {
  const ex = EX_BY_ID[id];
  if (!ex) return;
  openSheet(howToHTML(ex) + exerciseProgressHTML(id) + (state.active
    ? `<div style="margin-top:20px"><button class="btn btn-primary" data-action="add-from-info" data-id="${esc(id)}">Add to Workout</button></div>`
    : ""));
  animateDemo();
}

// Switch between the two pictures so it looks like a small animation
function animateDemo() {
  const demo = $("#demo");
  if (!demo) return;
  const imgs = demo.querySelectorAll("img");
  if (imgs.length < 2) return;
  let i = 0;
  const h = setInterval(() => {
    if (!document.body.contains(demo)) return clearInterval(h);
    i = 1 - i;
    imgs[1].classList.toggle("hide", i === 0);
  }, 1200);
}

/* ---------------- History tab ---------------- */

function historyHTML() {
  const list = state.workouts.slice().reverse();
  return `
    <div class="page">
      <h1 class="large-title">History</h1>
      ${list.length ? list.map(workoutCardHTML).join("") : `<div class="empty">No workouts yet.<br>Finish a workout and it will show up here.</div>`}
    </div>`;
}

/* ---------------- Bottom sheet ---------------- */

function openSheet(html, tall = false) {
  const root = $("#sheet-root");
  root.innerHTML = `
    <div class="backdrop" data-action="close-sheet"></div>
    <div class="sheet ${tall ? "tall" : ""}"><div class="grabber"></div>${html}</div>`;
}

function closeSheet() {
  const root = $("#sheet-root");
  const sheet = $(".sheet", root);
  if (!sheet) return;
  sheet.classList.add("out");
  $(".backdrop", root).classList.add("out");
  setTimeout(() => { root.innerHTML = ""; }, 280);
}

/* ---------------- Events ---------------- */

document.addEventListener("click", ev => {
  const tab = ev.target.closest(".tab");
  if (tab) return setTab(tab.dataset.tab);

  const btn = ev.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const card = btn.closest(".ex-card");
  const exIndex = card ? Number(card.dataset.ex) : -1;

  switch (action) {
    case "start": startWorkout(); break;
    case "theme":
      state.theme = state.theme === "sand" ? "graphite" : "sand";
      save();
      applyTheme();
      render();
      break;
    case "add-exercise": openExercisePicker(); break;
    case "close-sheet": closeSheet(); break;
    case "howto": openHowTo(btn.dataset.id); break;
    case "add-from-info":
      closeSheet();
      setTab("workout");
      addExerciseToWorkout(btn.dataset.id);
      break;

    case "add-set": {
      const e = state.active.exercises[exIndex];
      const last = e.sets[e.sets.length - 1];
      e.sets.push({ kg: last ? last.kg : "", reps: last ? last.reps : "", done: false });
      save();
      const prev = previousSets(e.exId);
      $("tbody", card).insertAdjacentHTML("beforeend", setRowHTML(e.sets[e.sets.length - 1], e.sets.length - 1, prev[e.sets.length - 1]));
      break;
    }

    case "toggle-set": {
      const row = btn.closest(".set-row");
      const j = Number(row.dataset.set);
      const e = state.active.exercises[exIndex];
      const s = e.sets[j];
      // If the fields are empty, use last time's numbers
      if (!s.done) {
        const kgIn = $('[data-field="kg"]', row);
        const repsIn = $('[data-field="reps"]', row);
        if (s.kg === "" && kgIn.placeholder !== "–") { s.kg = kgIn.placeholder; kgIn.value = s.kg; }
        if (s.reps === "" && repsIn.placeholder !== "–") { s.reps = repsIn.placeholder; repsIn.value = s.reps; }
        if (s.kg === "" && s.reps === "") { toast("Enter kg and reps first"); return; }
      }
      s.done = !s.done;
      row.classList.toggle("done", s.done);
      updateLiveStats();
      if (s.done && navigator.vibrate) navigator.vibrate(10);
      save();
      break;
    }

    case "remove-ex":
      state.active.exercises.splice(exIndex, 1);
      save();
      updateLiveStats();
      render();
      break;

    case "finish": finishWorkout(); break;
    case "save-workout": saveWorkout(); break;
    case "open-workout": openWorkoutDetail(btn.dataset.id); break;
    case "exercise-info": openExerciseInfo(btn.dataset.id); break;
    case "delete-workout":
      if (confirm("Delete this workout?")) {
        state.workouts = state.workouts.filter(w => w.id !== btn.dataset.id);
        save();
        closeSheet();
        render();
        toast("Workout deleted");
      }
      break;
    case "demo-data":
      addSampleWorkouts();
      render();
      toast("Sample workouts added");
      break;
    case "reset-data":
      if (confirm("Delete all workouts? This cannot be undone.")) {
        state.workouts = [];
        state.active = null;
        save();
        render();
      }
      break;

    case "discard":
      if (confirm("Discard this workout?")) {
        state.active = null;
        save();
        render();
      }
      break;
  }
});

// Save numbers while typing (without re-rendering, so the keyboard stays open)
document.addEventListener("input", ev => {
  const input = ev.target.closest(".num");
  if (!input || !state.active) return;
  const card = input.closest(".ex-card");
  const row = input.closest(".set-row");
  const s = state.active.exercises[Number(card.dataset.ex)].sets[Number(row.dataset.set)];
  s[input.dataset.field] = input.value.replace(",", ".").replace(/[^0-9.]/g, "");
  if (input.value !== s[input.dataset.field]) input.value = s[input.dataset.field];
  save();
  updateLiveStats();
});

document.addEventListener("keydown", ev => {
  if (ev.key === "Enter" && ev.target.id === "w-title") saveWorkout();
});

/* ---------------- Start ---------------- */

function applyTheme() {
  const theme = state.theme || "graphite";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "sand" ? "#efebe4" : "#1c1d21";
}

// Clock in the fake status bar (only visible on a computer)
function tickClock() {
  const d = new Date();
  $("#clock").textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
tickClock();
setInterval(tickClock, 10000);

applyTheme();
EXERCISES = window.EXERCISE_DATA || [];
EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
render();
