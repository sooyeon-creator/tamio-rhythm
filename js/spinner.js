// Shared sun-shaped loading spinner: 8 rays with descending opacity around
// the circle (a comet trail, not a fully-lit sun), spun by CSS so the
// bright point sweeps around. Loader.show()/hide() takes over the whole
// screen with just this icon — no other UI — while something loads.
const Spinner = (() => {
  // Clockwise from 12 o'clock, each [x1,y1,x2,y2,opacity].
  const RAYS = [
    [12, 1, 12, 3, 1],
    [18.36, 5.64, 19.78, 4.22, 0.75],
    [21, 12, 23, 12, 0.55],
    [18.36, 18.36, 19.78, 19.78, 0.38],
    [12, 21, 12, 23, 0.24],
    [4.22, 19.78, 5.64, 18.36, 0.14],
    [1, 12, 3, 12, 0.07],
    [4.22, 4.22, 5.64, 5.64, 0.02],
  ];

  function svg(sizePx = 28) {
    const rays = RAYS.map(([x1, y1, x2, y2, o]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" opacity="${o}"></line>`).join("");
    return `<svg class="spinner-sun" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      ${rays}
    </svg>`;
  }

  function row(sizePx, label) {
    return `<div class="loading-row">${svg(sizePx)}${label ? `<span>${label}</span>` : ""}</div>`;
  }

  return { svg, row };
})();

const Loader = (() => {
  let el = null;

  function ensure() {
    if (el) return el;
    el = document.getElementById("globalLoader");
    if (el && !el.dataset.filled) {
      el.innerHTML = Spinner.svg(56);
      el.dataset.filled = "1";
    }
    return el;
  }

  function show() {
    const node = ensure();
    if (node) node.hidden = false;
  }

  function hide() {
    const node = ensure();
    if (node) node.hidden = true;
  }

  return { show, hide };
})();
