// Beatmap editor: plays the chosen video in real time while the user taps
// the 6 lanes along the beat. Each touch becomes a tap / hold / slide note
// timestamped against video.currentTime.
const Editor = (() => {
  const LANES = 6;
  const HOLD_THRESHOLD_MS = 150;

  let video, lanesEl, timeEl, countEl, playPauseBtn, centerMsg;
  let notePanel, noteRowsEl;
  let notes = [];
  let activeTouches = new Map(); // pointerId -> { lane, startTime, currentLane }
  let file = null;
  let rafId = null;
  let onDone = null;

  function el(id) { return document.getElementById(id); }

  function buildLanes() {
    lanesEl.innerHTML = "";
    for (let i = 0; i < LANES; i++) {
      const lane = document.createElement("div");
      lane.className = "lane";
      lane.dataset.lane = String(i);
      lane.style.touchAction = "none";
      lanesEl.appendChild(lane);
    }
  }

  function laneFromPoint(x, y) {
    const target = document.elementFromPoint(x, y);
    const laneEl = target && target.closest ? target.closest(".lane") : null;
    return laneEl ? Number(laneEl.dataset.lane) : null;
  }

  function flashLane(index) {
    const laneEl = lanesEl.children[index];
    if (!laneEl) return;
    laneEl.classList.add("flash");
    setTimeout(() => laneEl.classList.remove("flash"), 100);
  }

  function onPointerDown(e) {
    if (video.paused) return;
    const lane = laneFromPoint(e.clientX, e.clientY);
    if (lane === null) return;
    e.preventDefault();
    activeTouches.set(e.pointerId, { lane, startTime: video.currentTime, currentLane: lane });
    flashLane(lane);
  }

  function onPointerMove(e) {
    const touch = activeTouches.get(e.pointerId);
    if (!touch) return;
    const lane = laneFromPoint(e.clientX, e.clientY);
    if (lane !== null && lane !== touch.currentLane) {
      touch.currentLane = lane;
      flashLane(lane);
    }
  }

  function finalizeTouch(e) {
    const touch = activeTouches.get(e.pointerId);
    if (!touch) return;
    activeTouches.delete(e.pointerId);
    const endTime = video.currentTime;
    const durationMs = (endTime - touch.startTime) * 1000;

    let note;
    if (touch.currentLane !== touch.lane) {
      note = { lane: touch.lane, time: touch.startTime, type: "slide", toLane: touch.currentLane, holdEnd: endTime };
    } else if (durationMs >= HOLD_THRESHOLD_MS) {
      note = { lane: touch.lane, time: touch.startTime, type: "hold", holdEnd: endTime };
    } else {
      note = { lane: touch.lane, time: touch.startTime, type: "tap" };
    }
    notes.push(note);
    notes.sort((a, b) => a.time - b.time);
    countEl.textContent = String(notes.length);
    if (!notePanel.hidden) renderNotePanel();
  }

  function onPointerUp(e) {
    finalizeTouch(e);
  }

  function tick() {
    timeEl.textContent = video.currentTime.toFixed(2);
    rafId = requestAnimationFrame(tick);
  }

  function formatTime(t) {
    return t.toFixed(2) + "s";
  }

  function typeLabel(note) {
    if (note.type === "tap") return `Tap · Lane ${note.lane + 1}`;
    if (note.type === "hold") return `Hold · Lane ${note.lane + 1} (${formatTime(note.holdEnd - note.time)})`;
    return `Slide · Lane ${note.lane + 1} → ${note.toLane + 1}`;
  }

  function renderNotePanel() {
    noteRowsEl.innerHTML = "";
    if (!notes.length) {
      noteRowsEl.innerHTML = '<li class="hint">아직 기록된 노트가 없습니다.</li>';
      return;
    }
    notes.forEach((note, index) => {
      const li = document.createElement("li");
      const info = document.createElement("span");
      info.className = "note-info";
      info.innerHTML = `<span>${formatTime(note.time)}</span><span>${typeLabel(note)}</span>`;
      const actions = document.createElement("span");
      const seekBtn = document.createElement("button");
      seekBtn.className = "seek";
      seekBtn.textContent = "이동";
      seekBtn.onclick = () => {
        video.pause();
        playPauseBtn.textContent = "▶ 재생";
        video.currentTime = Math.max(0, note.time - 0.3);
      };
      const delBtn = document.createElement("button");
      delBtn.className = "del";
      delBtn.textContent = "삭제";
      delBtn.onclick = () => {
        notes.splice(index, 1);
        countEl.textContent = String(notes.length);
        renderNotePanel();
      };
      actions.appendChild(seekBtn);
      actions.appendChild(delBtn);
      li.appendChild(info);
      li.appendChild(actions);
      noteRowsEl.appendChild(li);
    });
  }

  function init(selectedFile, callbacks) {
    file = selectedFile;
    onDone = callbacks.onDone;
    notes = [];
    activeTouches.clear();

    video = el("editorVideo");
    lanesEl = el("editorLanes");
    timeEl = el("editorTime");
    countEl = el("editorNoteCount");
    playPauseBtn = el("editorPlayPause");
    centerMsg = el("editorCenterMsg");
    notePanel = el("editorNotePanel");
    noteRowsEl = el("editorNoteRows");
    notePanel.hidden = true;

    video.src = URL.createObjectURL(file);
    video.currentTime = 0;
    countEl.textContent = "0";
    timeEl.textContent = "0.00";
    centerMsg.hidden = false;
    centerMsg.querySelector("h2").textContent = "비트맵 에디터";
    centerMsg.querySelector("p").textContent =
      "재생을 누르고, 박자에 맞춰 6개 레인을 탭하세요. 길게 누르면 홀드 노트, 누른 채로 옆 레인으로 밀면 슬라이드 노트가 됩니다. 언제든 상단의 \"저장\" 버튼으로 저장할 수 있습니다.";
    el("editorStart").hidden = false;

    buildLanes();

    lanesEl.onpointerdown = onPointerDown;
    lanesEl.onpointermove = onPointerMove;
    lanesEl.onpointerup = onPointerUp;
    lanesEl.onpointercancel = onPointerUp;

    el("editorStart").onclick = () => {
      centerMsg.hidden = true;
      video.play().catch(() => {});
      playPauseBtn.textContent = "⏸ 일시정지";
      rafId = requestAnimationFrame(tick);
    };

    el("editorSave").onclick = save;
    el("editorBack").onclick = () => teardown(() => onDone(null));

    el("editorEdit").onclick = () => {
      video.pause();
      playPauseBtn.textContent = "▶ 재생";
      renderNotePanel();
      notePanel.hidden = false;
    };
    el("editorNotePanelClose").onclick = () => { notePanel.hidden = true; };
    el("editorClearAll").onclick = () => {
      if (notes.length && !confirm("모든 노트를 삭제할까요?")) return;
      notes = [];
      countEl.textContent = "0";
      renderNotePanel();
    };

    playPauseBtn.onclick = () => {
      if (video.paused) {
        video.play().catch(() => {});
        playPauseBtn.textContent = "⏸ 일시정지";
      } else {
        video.pause();
        playPauseBtn.textContent = "▶ 재생";
      }
    };

    video.onended = () => {
      video.pause();
      playPauseBtn.textContent = "▶ 재생";
      centerMsg.querySelector("h2").textContent = "영상이 끝났습니다";
      centerMsg.querySelector("p").textContent = `${notes.length}개 노트를 기록했습니다. 저장 버튼을 눌러 저장하세요.`;
      el("editorStart").hidden = true;
      centerMsg.hidden = false;
    };
  }

  function save() {
    video.pause();
    const key = Storage.keyFor(file);
    const chart = {
      key,
      videoName: file.name,
      videoSize: file.size,
      duration: video.duration || 0,
      laneCount: LANES,
      notes: notes.slice().sort((a, b) => a.time - b.time),
      createdAt: Date.now(),
    };
    Storage.saveChart(key, chart);
    teardown(() => onDone(chart));
  }

  function teardown(after) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (video) {
      video.pause();
      video.onended = null;
      if (video.src) URL.revokeObjectURL(video.src);
      video.removeAttribute("src");
      video.load();
    }
    lanesEl.onpointerdown = null;
    lanesEl.onpointermove = null;
    lanesEl.onpointerup = null;
    lanesEl.onpointercancel = null;
    if (after) after();
  }

  return { init };
})();
