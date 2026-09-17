// Wires the home screen to the Editor and Player modules and handles
// switching between the three full-screen views.
(() => {
  const views = {
    home: document.getElementById("view-home"),
    editor: document.getElementById("view-editor"),
    player: document.getElementById("view-player"),
  };

  let selectedFile = null;

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

  function updateButtons() {
    const hasFile = !!selectedFile;
    document.getElementById("openEditor").disabled = !hasFile;
    document.getElementById("openPlayer").disabled = !hasFile || !currentChartForFile();
  }

  function currentChartForFile() {
    if (!selectedFile) return null;
    return Storage.getChart(Storage.keyFor(selectedFile));
  }

  document.getElementById("videoFile").addEventListener("change", (e) => {
    selectedFile = e.target.files[0] || null;
    const info = document.getElementById("videoInfo");
    if (selectedFile) {
      const chart = currentChartForFile();
      info.textContent = chart
        ? `"${selectedFile.name}" — 저장된 비트맵 ${chart.notes.length}개 노트 발견`
        : `"${selectedFile.name}" — 아직 비트맵이 없습니다. 에디터에서 만들어보세요.`;
    } else {
      info.textContent = "영상을 선택하면 그 영상 이름으로 비트맵이 저장/불러오기 됩니다.";
    }
    updateButtons();
  });

  document.getElementById("openEditor").addEventListener("click", () => {
    if (!selectedFile) return;
    showView("editor");
    Editor.init(selectedFile, {
      onDone: () => {
        showView("home");
        refreshChartList();
        updateButtons();
      },
    });
  });

  document.getElementById("openPlayer").addEventListener("click", () => {
    const chart = currentChartForFile();
    if (!selectedFile || !chart) return;
    showView("player");
    Player.init(selectedFile, chart, {
      onDone: () => {
        showView("home");
        refreshChartList();
        updateButtons();
      },
    });
  });

  refreshChartList();
  updateButtons();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
