// localStorage-backed chart + score storage.
// A chart is keyed by the video file's name+size (no video bytes are ever stored).
const Storage = (() => {
  const CHART_PREFIX = "tamio:chart:";
  const SCORE_PREFIX = "tamio:best:";
  const INDEX_KEY = "tamio:chartIndex";

  function keyFor(file) {
    return `${file.name}::${file.size}`;
  }

  function loadIndex() {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveIndex(index) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  function getChart(key) {
    const raw = localStorage.getItem(CHART_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  }

  function saveChart(key, chart) {
    localStorage.setItem(CHART_PREFIX + key, JSON.stringify(chart));
    const index = loadIndex();
    if (!index.find((c) => c.key === key)) {
      index.push({ key, videoName: chart.videoName, noteCount: chart.notes.length });
      saveIndex(index);
    } else {
      const entry = index.find((c) => c.key === key);
      entry.noteCount = chart.notes.length;
      saveIndex(index);
    }
  }

  function deleteChart(key) {
    localStorage.removeItem(CHART_PREFIX + key);
    localStorage.removeItem(SCORE_PREFIX + key);
    saveIndex(loadIndex().filter((c) => c.key !== key));
  }

  function getBest(key) {
    const raw = localStorage.getItem(SCORE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  }

  function saveBest(key, result) {
    const current = getBest(key);
    if (!current || result.score > current.score) {
      localStorage.setItem(SCORE_PREFIX + key, JSON.stringify(result));
    }
  }

  function listCharts() {
    return loadIndex();
  }

  return { keyFor, getChart, saveChart, deleteChart, getBest, saveBest, listCharts };
})();
