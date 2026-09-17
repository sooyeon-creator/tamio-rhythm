// Shared sun-shaped loading spinner markup, reused wherever the app has to
// wait on something (fetching the video list, buffering a video).
const Spinner = (() => {
  function svg(sizePx = 28) {
    return `<svg class="spinner-sun" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>`;
  }

  function row(sizePx, label) {
    return `<div class="loading-row">${svg(sizePx)}${label ? `<span>${label}</span>` : ""}</div>`;
  }

  return { svg, row };
})();
