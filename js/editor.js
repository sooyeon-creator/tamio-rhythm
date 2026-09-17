// Beatmap editor: plays the chosen video in real time while the user taps
// the 6 lanes along the beat. Each touch becomes a tap / hold / slide note
// timestamped against video.currentTime.
const Editor = (() => {
  const LANES = 6;
  const HOLD_THRESHOLD_MS = 150;
  const LEAD_TIME = 1.8; // seconds a note takes to fall from top to the hit line, matches Player

  let video, canvas, ctx, lanesEl, timeEl, countEl, playPauseBtn, centerMsg;
  let notePanel, noteRowsEl;
  let notes = [];
  let activeTouches = new Map(); // pointerId -> { lane, startTime, currentLane }
  let source = null;
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

  function resizeCanvas() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }

  function laneCenterX(i) {
    const w = canvas.width / LANES;
    return w * (i + 0.5);
  }

  function yForTime(t, now) {
    const hitLineY = canvas.height * 0.86;
    const progress = (t - now) / LEAD_TIME; // 1 = just spawned, 0 = at hit line
    return hitLineY * (1 - progress);
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Note width tracks the lane width (slightly narrower than the lane
    // itself) instead of a fixed pixel size, so notes read clearly at any
    // lane count/screen size.
    const r = (canvas.width / LANES) * 0.4;

    for (const note of notes) {
      if (note.time - now > LEAD_TIME + 0.3) continue;
      if (now - (note.holdEnd ?? note.time) > 0.6) continue;

      const x = laneCenterX(note.lane);
      if (note.type === "tap") {
        const y = yForTime(note.time, now);
        ctx.fillStyle = "#6ee7ff";
        ctx.beginPath();
        ctx.roundRect(x - r, y - r * 0.4, r * 2, r * 0.8, r * 0.4);
        ctx.fill();
      } else if (note.type === "hold") {
        const yStart = yForTime(note.time, now);
        const yEnd = yForTime(note.holdEnd, now);
        ctx.fillStyle = "rgba(110,231,255,0.55)";
        ctx.fillRect(x - r * 0.6, Math.min(yEnd, yStart), r * 1.2, Math.abs(yStart - yEnd) + r * 0.6);
        ctx.fillStyle = "#6ee7ff";
        ctx.beginPath();
        ctx.roundRect(x - r, yStart - r * 0.4, r * 2, r * 0.8, r * 0.4);
        ctx.fill();
      } else if (note.type === "slide") {
        SlideRender.draw(ctx, note, now, {
          laneCenterX, yForTime, lineWidth: r * 0.8,
          stroke: "rgba(255,110,199,0.6)", fill: "#ff6ec7",
        });
      }
    }

    // Live preview of whatever is currently being held/dragged: the actual
    // staircase recorded so far, ending live at "now" in the current lane.
    for (const touch of activeTouches.values()) {
      const provisional = { lane: touch.path[0].lane, time: touch.path[0].time, toLane: touch.currentLane, holdEnd: now, path: touch.path };
      SlideRender.draw(ctx, provisional, now, {
        laneCenterX, yForTime, lineWidth: r * 0.7,
        stroke: "#ffffff", fill: "#ffffff",
      });
    }
  }

  function setLaneLit(index, lit) {
    const laneEl = lanesEl.children[index];
    if (!laneEl) return;
    laneEl.classList.toggle("flash", lit);
  }

  function onPointerDown(e) {
    if (video.paused) return;
    const lane = laneFromPoint(e.clientX, e.clientY);
    if (lane === null) return;
    e.preventDefault();
    const startTime = video.currentTime;
    activeTouches.set(e.pointerId, { lane, startTime, currentLane: lane, path: [{ lane, time: startTime }] });
    setLaneLit(lane, true);
  }

  function onPointerMove(e) {
    const touch = activeTouches.get(e.pointerId);
    if (!touch) return;
    e.preventDefault();
    const lane = laneFromPoint(e.clientX, e.clientY);
    if (lane !== null && lane !== touch.currentLane) {
      setLaneLit(touch.currentLane, false);
      touch.currentLane = lane;
      touch.path.push({ lane, time: video.currentTime });
      setLaneLit(lane, true);
    }
  }

  function finalizeTouch(e) {
    const touch = activeTouches.get(e.pointerId);
    if (!touch) return;
    activeTouches.delete(e.pointerId);
    setLaneLit(touch.currentLane, false);
    const endTime = video.currentTime;
    const durationMs = (endTime - touch.startTime) * 1000;

    let note;
    if (touch.currentLane !== touch.lane) {
      note = { lane: touch.lane, time: touch.startTime, type: "slide", toLane: touch.currentLane, holdEnd: endTime, path: touch.path };
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
    const now = video.currentTime;
    timeEl.textContent = now.toFixed(2);
    draw(now);
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

  function init(selectedSource, callbacks) {
    source = selectedSource;
    onDone = callbacks.onDone;
    notes = [];
    activeTouches.clear();

    video = el("editorVideo");
    canvas = el("editorCanvas");
    ctx = canvas.getContext("2d");
    lanesEl = el("editorLanes");
    timeEl = el("editorTime");
    countEl = el("editorNoteCount");
    playPauseBtn = el("editorPlayPause");
    centerMsg = el("editorCenterMsg");
    notePanel = el("editorNotePanel");
    noteRowsEl = el("editorNoteRows");
    notePanel.hidden = true;

    countEl.textContent = "0";
    timeEl.textContent = "0.00";
    centerMsg.hidden = false;
    centerMsg.querySelector("h2").textContent = "비트맵 에디터";
    centerMsg.querySelector("p").textContent =
      "재생을 누르고, 박자에 맞춰 6개 레인을 탭하세요. 길게 누르면 홀드 노트, 누른 채로 옆 레인으로 밀면 슬라이드 노트가 됩니다. 언제든 상단의 \"저장\" 버튼으로 저장할 수 있습니다.";

    video.src = source.url;
    video.currentTime = 0;
    if (video.readyState >= 2) {
      Loader.hide();
    } else {
      Loader.show();
      video.addEventListener("loadeddata", Loader.hide, { once: true });
    }

    buildLanes();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    lanesEl.onpointerdown = onPointerDown;
    lanesEl.onpointermove = onPointerMove;
    lanesEl.onpointerup = onPointerUp;
    lanesEl.onpointercancel = onPointerUp;

    el("editorStart").onclick = () => {
      Fullscreen.enter();
      centerMsg.hidden = true;
      video.play().catch(() => {});
      playPauseBtn.textContent = "⏸ 일시정지";
      rafId = requestAnimationFrame(tick);
    };

    el("editorSave").onclick = save;
    el("editorExport").onclick = exportChart;
    el("editorBack").onclick = () => { Fullscreen.exit(); teardown(() => onDone(null)); };

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

  function buildChart() {
    return {
      videoName: source.name,
      duration: video.duration || 0,
      laneCount: LANES,
      notes: notes.slice().sort((a, b) => a.time - b.time),
      createdAt: Date.now(),
    };
  }

  function save() {
    video.pause();
    Fullscreen.exit();
    const key = source.key;
    const chart = { key, ...buildChart() };
    Storage.saveChart(key, chart);
    teardown(() => onDone(chart));
  }

  // Downloads just the note timing (no video, no key tied to this device)
  // as a JSON file — this is what gets committed to charts/ so a link can
  // hand the exact same timing to someone else, independent of who has
  // the matching video file.
  function exportChart() {
    const chart = buildChart();
    const blob = new Blob([JSON.stringify(chart, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = chart.videoName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
    a.href = url;
    a.download = `${slug || "chart"}.tamio.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function teardown(after) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    Loader.hide();
    window.removeEventListener("resize", resizeCanvas);
    if (video) {
      video.pause();
      video.onended = null;
      if (source && source.isBlob && video.src) URL.revokeObjectURL(video.src);
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
