// Thin haptics layer. Uses the Web Vibration API today (Android Chrome only;
// iOS Safari has no vibration API). When this project is later wrapped with
// Capacitor for a native shell, swap the body of `fire()` for
// `Haptics.impact(...)` from @capacitor/haptics — call sites don't change.
const Haptics = (() => {
  const supported = typeof navigator !== "undefined" && !!navigator.vibrate;

  function fire(pattern) {
    if (!supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore — vibration is a nice-to-have, never block gameplay on it
    }
  }

  return {
    tap: () => fire(10),
    perfect: () => fire(15),
    good: () => fire(10),
    miss: () => fire([0, 30, 40, 30]),
    comboMilestone: () => fire([0, 15, 30, 15, 30, 25]),
  };
})();
