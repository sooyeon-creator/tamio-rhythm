// Wires the home screen to the Editor and Player modules and handles
// switching between the three full-screen views.
//
// A "source" describes where a video comes from, so Editor/Player never
// need to know if it was picked locally or served from videos/:
//   { key, name, url, isBlob }
(() => {
  const views = {
    home: document.getElementById("view-home"),
    editor: document.getElementById("view-editor"),
    player: document.getElementById("view-player"),
  };

  let currentSource = null;

  function showView(name) {
    for (const key of Object.keys(views)) {
      views[key].hidden = key !== name;
    }
  }

  function refreshChartList() {
    const listEl = document.getElementById("chartList");
    const charts = Storage.listCharts();
    if (!charts.length) {
      listEl.innerHTML = '<li class="hint">아직 저장된 비트맵이 없습니다.</li>';
      return;
    }
    listEl.innerHTML = "";
    for (const entry of charts) {
      const li = document.createElement("li");
      const best = Storage.getBest(entry.key);
      const bestText = best ? ` · Best ${best.score}` : "";
      li.innerHTML = `<span>${entry.videoName} (${entry.noteCount} notes)${bestText}</span>`;
      const del = document.createElement("button");
      del.textContent = "삭제";
      del.onclick = () => {
        Storage.deleteChart(entry.key);
        refreshChartList();
      };
      li.appendChild(del);
      listEl.appendChild(li);
    }
  }

  function currentChart() {
    if (!currentSource) return null;
    return Storage.getChart(currentSource.key);
  }

  function updateButtons() {
    document.getElementById("openEditor").disabled = !currentSource;
    document.getElementById("openPlayer").disabled = !currentSource || !currentChart();
  }

  function selectSource(source) {
    currentSource = source;
    const chart = currentChart();
    const info = document.getElementById("videoInfo");
    if (info) {
      info.textContent = chart
        ? `"${source.name}" — 저장된 비트맵 ${chart.notes.length}개 노트 발견`
        : `"${source.name}" — 아직 비트맵이 없습니다. 에디터에서 만들어보세요.`;
    }
    document.querySelectorAll("#repoVideoList li.selectable").forEach((li) => {
      li.classList.toggle("selected", li.dataset.key === source.key);
    });
    updateButtons();
  }

  async function loadRepoVideos() {
    const listEl = document.getElementById("repoVideoList");
    Loader.show();
    try {
      const res = await fetch("videos/manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error("no manifest");
      const entries = await res.json();
      if (!entries.length) {
        listEl.innerHTML = '<li class="hint">videos/ 폴더에 등록된 영상이 없습니다.</li>';
        return;
      }
      listEl.innerHTML = "";
      for (const entry of entries) {
        const key = `repo:${entry.file}`;
        const li = document.createElement("li");
        li.className = "selectable";
        li.dataset.key = key;
        const chart = Storage.getChart(key);
        const best = Storage.getBest(key);
        const meta = chart ? `${chart.notes.length} notes${best ? ` · Best ${best.score}` : ""}` : "비트맵 없음";
        li.innerHTML = `<span>${entry.name}</span><span class="hint">${meta}</span>`;
        li.onclick = () => {
          selectSource({ key, name: entry.name, url: `videos/${entry.file}`, isBlob: false });
        };
        listEl.appendChild(li);
      }
    } catch {
      listEl.innerHTML = '<li class="hint">videos/manifest.json을 불러오지 못했습니다.</li>';
    } finally {
      Loader.hide();
    }
  }

  document.getElementById("videoFile").addEventListener("change", (e) => {
    const file = e.target.files[0] || null;
    if (!file) return;
    selectSource({ key: Storage.keyFor(file), name: file.name, url: URL.createObjectURL(file), isBlob: true });
  });

  document.getElementById("openEditor").addEventListener("click", () => {
    if (!currentSource) return;
    showView("editor");
    Editor.init(currentSource, {
      onDone: () => {
        showView("home");
        refreshChartList();
        loadRepoVideos();
        updateButtons();
      },
    });
  });

  document.getElementById("openPlayer").addEventListener("click", () => {
    const chart = currentChart();
    if (!currentSource || !chart) return;
    showView("player");
    Player.init(currentSource, chart, {
      onDone: () => {
        showView("home");
        refreshChartList();
        loadRepoVideos();
        updateButtons();
      },
    });
  });

  refreshChartList();
  loadRepoVideos();
  updateButtons();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
