// Thin wrapper around the Fullscreen API (with vendor prefixes) so the
// game can hide the browser chrome during play. Must be called from a
// user gesture (a click handler) or the browser silently ignores it.
// Note: iOS Safari does not support this API for arbitrary elements in a
// regular browser tab — there, "Add to Home Screen" (the PWA manifest's
// display:"fullscreen") is the only way to get a chrome-free screen.
const Fullscreen = (() => {
  function enter() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!req) return;
    try {
      const result = req.call(el);
      if (result && result.catch) result.catch(() => {});
    } catch {
      // ignore — fullscreen is a nice-to-have, never block gameplay on it
    }
  }

  function exit() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!isFullscreen) return;
    const ex = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (!ex) return;
    try {
      const result = ex.call(document);
      if (result && result.catch) result.catch(() => {});
    } catch {
      // ignore
    }
  }

  return { enter, exit };
})();
