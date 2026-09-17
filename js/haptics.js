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

  // A repeating short-pulse pattern, replayed for the length of a hold/slide
  // note so it reads as a continuous tremble rather than one-off buzzes.
  function buildHoldPattern(durationMs) {
    const cycleMs = 80;
    const onMs = 12;
    const cycles = Math.max(1, Math.round(durationMs / cycleMs));
    const pattern = [];
    for (let i = 0; i < cycles; i++) pattern.push(onMs, cycleMs - onMs);
    return pattern;
  }

  return {
    tap: () => fire(10),
    perfect: () => fire(15),
    good: () => fire(10),
    miss: () => fire([0, 30, 40, 30]),
    comboMilestone: () => fire([0, 15, 30, 15, 30, 25]),
    // Call when a hold/slide note is caught on time; call holdStop() the
    // moment it's released, missed, or the note's window ends.
    holdStart: (durationMs) => fire(buildHoldPattern(durationMs)),
    holdStop: () => fire(0),
  };
})();
