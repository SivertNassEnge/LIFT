/* =========================================================
   Muscle map: a simple drawn body (front and back).
   Muscles light up like a heat camera based on how much
   they were trained.
   ========================================================= */

// Left side shapes. The right side is drawn by mirroring them.
const BODY_FRONT = {
  shoulders: "M79 68 C64 65 53 74 51 90 C55 97 62 99 67 96 C69 84 73 76 81 72 Z",
  chest:     "M98 72 L82 72 C71 78 67 90 69 104 C77 112 90 112 98 108 Z",
  biceps:    "M51 97 C47 111 47 124 51 136 C57 139 62 137 64 132 C66 118 66 106 65 99 C60 100 55 100 51 97 Z",
  forearms:  "M50 141 C44 156 42 171 44 186 L53 188 C58 172 62 156 63 140 C59 142 54 142 50 141 Z",
  obliques:  "M88 113 C80 114 74 116 71 120 C70 140 74 156 82 170 L89 168 Z",
  quads:     "M74 184 C67 210 67 240 73 262 C81 267 90 265 96 258 C98 236 98 209 96 188 C89 182 80 180 74 184 Z",
  abductors: "M70 176 C64 186 62 201 65 215 L71 212 C70 200 71 188 75 179 Z",
  calves:    "M73 277 C68 300 70 324 75 344 L85 344 C89 321 90 298 88 277 Z"
};
const BODY_FRONT_CENTER = {
  traps: "M92 57 L100 60 L108 57 L118 67 L100 66 L82 67 Z",
  abs:   "M91 113 L109 113 L110 166 C106 175 94 175 90 166 Z"
};

const BODY_BACK = {
  shoulders:    "M79 68 C64 65 53 74 51 90 C55 97 62 99 67 96 C69 84 73 76 81 72 Z",
  "upper back": "M88 77 L81 74 C73 80 72 92 76 101 L92 106 L95 96 Z",
  lats:         "M76 103 C72 119 74 136 82 151 L97 155 L97 109 L92 107 Z",
  triceps:      "M51 97 C47 111 47 124 51 136 C57 139 62 137 64 132 C66 118 66 106 65 99 C60 100 55 100 51 97 Z",
  forearms:     "M50 141 C44 156 42 171 44 186 L53 188 C58 172 62 156 63 140 C59 142 54 142 50 141 Z",
  glutes:       "M99 175 L85 173 C73 177 68 191 72 205 C80 213 93 213 99 207 Z",
  hamstrings:   "M72 211 C68 233 70 252 74 266 L94 266 C98 248 98 229 98 213 C90 215 80 215 72 211 Z",
  calves:       "M72 277 C66 297 68 317 74 333 L86 333 C90 314 90 294 88 277 Z"
};
const BODY_BACK_CENTER = {
  traps:        "M100 52 L89 59 L77 69 L90 74 L100 104 L110 74 L123 69 L111 59 Z",
  "lower back": "M87 151 L113 151 L114 172 L86 172 Z"
};

// Parts that are never trained here (head, hands, knees, feet)
const BODY_BASE = `
  <ellipse cx="100" cy="31" rx="17" ry="21"/>
  <rect x="91" y="48" width="18" height="12" rx="4"/>
  <ellipse cx="47" cy="197" rx="6" ry="10"/><ellipse cx="153" cy="197" rx="6" ry="10"/>
  <path d="M83 168 L117 168 L122 186 L100 196 L78 186 Z"/>
  <ellipse cx="82" cy="270" rx="9" ry="7"/><ellipse cx="118" cy="270" rx="9" ry="7"/>
  <ellipse cx="80" cy="352" rx="9" ry="6"/><ellipse cx="120" cy="352" rx="9" ry="6"/>
  <path d="M86 337 L84 346 L76 346 L75 337 Z"/><path d="M114 337 L116 346 L124 346 L125 337 Z"/>
  <path d="M100 110 L92 108 L92 168 L108 168 L108 108 Z" class="back-only"/>`;

// How much each muscle was trained: primary = 1 per set, secondary = 0.5 per set
function muscleScores(workouts) {
  const scores = {};
  for (const w of workouts) {
    for (const e of w.exercises) {
      const ex = EX_BY_ID[e.exId];
      if (!ex) continue;
      const sets = e.sets.length || 1;
      ex.p.forEach(m => { scores[m] = (scores[m] || 0) + sets; });
      ex.s.forEach(m => { scores[m] = (scores[m] || 0) + sets * 0.5; });
    }
  }
  return scores;
}

// Heat colour: light red (little) -> deep red (a lot)
function heatColor(level, alpha = 1) {
  const l = Math.max(0, Math.min(1, level));
  const hue = 24 - l * 20;         // orange -> red
  const light = 76 - l * 28;       // light -> strong
  return `hsla(${hue}, 100%, ${light}%, ${alpha})`;
}

function muscleMapSVG(scores) {
  const max = Math.max(1, ...Object.values(scores));
  const fill = m => scores[m] ? heatColor(scores[m] / max) : "var(--body)";
  const glow = m => scores[m] && scores[m] / max > .55 ? ' filter="url(#glow)"' : "";

  const side = (shapes, centers) => {
    let out = "";
    for (const [m, d] of Object.entries(shapes)) {
      out += `<path d="${d}" fill="${fill(m)}"${glow(m)}/>`;
      out += `<path d="${d}" fill="${fill(m)}"${glow(m)} transform="translate(200 0) scale(-1 1)"/>`;
    }
    for (const [m, d] of Object.entries(centers)) {
      out += `<path d="${d}" fill="${fill(m)}"${glow(m)}/>`;
    }
    return out;
  };

  const defs = `<defs><filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>`;

  return `
    <div class="body-map">
      <figure>
        <svg viewBox="40 0 120 362" aria-label="Front">${defs}
          <g fill="var(--body-base)">${BODY_BASE.replace(/<path[^>]*class="back-only"\/>/, "")}</g>
          <g stroke="var(--body-line)" stroke-width="1.2" stroke-linejoin="round">${side(BODY_FRONT, BODY_FRONT_CENTER)}</g>
          <g stroke="var(--body-line)" stroke-width=".8" opacity=".5" fill="none">
            <path d="M91 127 L109 127 M91 141 L109 141 M91 154 L109 154 M100 113 L100 172"/>
          </g>
        </svg>
        <figcaption>Front</figcaption>
      </figure>
      <figure>
        <svg viewBox="40 0 120 362" aria-label="Back">${defs}
          <g fill="var(--body-base)">${BODY_BASE}</g>
          <g stroke="var(--body-line)" stroke-width="1.2" stroke-linejoin="round">${side(BODY_BACK, BODY_BACK_CENTER)}</g>
        </svg>
        <figcaption>Back</figcaption>
      </figure>
    </div>`;
}

// Map + a list of the muscles, strongest first
function muscleSectionHTML(workouts) {
  const scores = muscleScores(workouts);
  const max = Math.max(1, ...Object.values(scores));
  const list = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return `
    ${muscleMapSVG(scores)}
    <div class="heat-legend"><span>Less</span><i></i><span>More</span></div>
    <div class="muscles center">
      ${list.map(([m, v]) => `<span class="tag" style="background:${heatColor(v / max, .16)};color:${heatColor(Math.max(.5, v / max))}">${esc(m)}</span>`).join("")}
    </div>`;
}
