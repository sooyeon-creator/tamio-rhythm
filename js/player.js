// Gameplay: replays the video as the timing source, drops notes toward the
// hit line, and judges taps/holds/slides against the stored chart.
const Player = (() => {
  const LEAD_TIME = 1.8; // seconds a note takes to fall from top to the hit line
  const PERFECT_MS = 50;
  const GOOD_MS = 120;
  const MISS_MS = 200;

  let video, canvas, ctx, lanesEl, scoreEl, comboEl, toastEl, centerMsg;
  let source = null, chart = null, laneCount = 6;
  let notes = [];
  let heldPointers = new Map(); // pointerId -> { note, lane }
  let score = 0, combo = 0, maxCombo = 0;
  let counts = { perfect: 0, good: 0, miss: 0 };
  let rafId = null;
  let onDone = null;
  let running = false;

  function el(id) { return document.getElementById(id); }

  function buildLanes() {
    lanesEl.innerHTML = "";
    for (let i = 0; i < laneCount; i++) {
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

  function judge(deltaSeconds) {
    const ms = Math.abs(deltaSeconds) * 1000;
    if (ms <= PERFECT_MS) return "perfect";
    if (ms <= GOOD_MS) return "good";
    return "miss";
  }

  function scoreFor(judgment) {
    if (judgment === "perfect") return 300;
    if (judgment === "good") return 100;
    return 0;
  }

  function flashLane(index) {
    const laneEl = lanesEl.children[index];
    if (!laneEl) return;
    laneEl.classList.add("flash");
    setTimeout(() => laneEl.classList.remove("flash"), 100);
  }

  function showToast(judgment) {
    const label = judgment === "perfect" ? "PERFECT" : judgment === "good" ? "GOOD" : "MISS";
    const color = judgment === "perfect" ? "var(--perfect)" : judgment === "good" ? "var(--good)" : "var(--miss)";
    toastEl.textContent = label;
    toastEl.style.color = color;
    toastEl.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.style.opacity = "0"; }, 220);
  }

  function applyJudgment(judgment) {
    counts[judgment]++;
    if (judgment === "miss") {
      combo = 0;
      Haptics.miss();
    } else {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (combo > 0 && combo % 20 === 0) Haptics.comboMilestone();
      else if (judgment === "perfect") Haptics.perfect();
      else Haptics.good();
    }
    score += scoreFor(judgment) + Math.floor(combo / 10) * 10;
    scoreEl.textContent = String(score);
    comboEl.textContent = String(combo);
    showToast(judgment);
  }

  function findClosestUnjudgedNote(lane, now) {
    let best = null, bestDelta = Infinity;
    for (const note of notes) {
      if (note.judged || note.lane !== lane) continue;
      const delta = Math.abs(now - note.time);
      if (delta < bestDelta && delta <= MISS_MS / 1000) {
        best = note;
        bestDelta = delta;
      }
    }
    return best;
  }

  function onPointerDown(e) {
    if (!running) return;
    const lane = laneFromPoint(e.clientX, e.clientY);
    if (lane === null) return;
    e.preventDefault();
    const now = video.currentTime;
    const note = findClosestUnjudgedNote(lane, now);
    flashLane(lane);
    if (!note) return;
    note.judged = true;
    applyJudgment(judge(now - note.time));
    if (note.type === "hold" || note.type === "slide") {
      heldPointers.set(e.pointerId, { note, lane });
    }
  }

  function onPointerUp(e) {
    const held = heldPointers.get(e.pointerId);
    if (!held) return;
    heldPointers.delete(e.pointerId);
    const { note } = held;
    const now = video.currentTime;
    if (note.type === "hold") {
      applyJudgment(judge(now - note.holdEnd));
    } else if (note.type === "slide") {
      const currentLane = laneFromPoint(e.clientX, e.clientY);
      const laneOk = currentLane === note.toLane;
      applyJudgment(laneOk ? judge(now - note.holdEnd) : "miss");
    }
  }

  function autoMissSweep(now) {
    for (const note of notes) {
      if (note.judged) continue;
      if (now - note.time > MISS_MS / 1000) {
        note.judged = true;
        applyJudgment("miss");
      }
    }
    for (const [pointerId, held] of heldPointers) {
      const endTime = held.note.holdEnd;
      if (now - endTime > MISS_MS / 1000) {
        heldPointers.delete(pointerId);
      }
    }
  }

  function laneCenterX(i) {
    const w = canvas.width / laneCount;
    return w * (i + 0.5);
  }

  function yForTime(t, now) {
    const hitLineY = canvas.height * 0.86;
    const progress = (t - now) / LEAD_TIME; // 1 = just spawned, 0 = at hit line
    return hitLineY * (1 - progress);
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = 16 * devicePixelRatio;
    for (const note of notes) {
      if (note.judged && note.type === "tap") continue;
      if (note.time - now > LEAD_TIME + 0.3) continue;
      if (note.time - now < -MISS_MS / 1000 - 0.3 && note.judged) continue;

      const x = laneCenterX(note.lane);
      if (note.type === "tap") {
        const y = yForTime(note.time, now);
        if (y < -r * 2 || y > canvas.height + r * 2) continue;
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
        const x2 = laneCenterX(note.toLane);
        const yStart = yForTime(note.time, now);
        const yEnd = yForTime(note.holdEnd, now);
        ctx.strokeStyle = "rgba(255,110,199,0.6)";
        ctx.lineWidth = r * 0.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, yStart);
        ctx.lineTo(x2, yEnd);
        ctx.stroke();
        ctx.fillStyle = "#ff6ec7";
        ctx.beginPath();
        ctx.arc(x, yStart, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function loop() {
    if (!running) return;
    const now = video.currentTime;
    autoMissSweep(now);
    draw(now);
    if (video.ended) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    const total = counts.perfect + counts.good + counts.miss;
    const accuracy = total ? ((counts.perfect + counts.good * 0.5) / total) * 100 : 0;
    const result = { score, maxCombo, accuracy, counts, updatedAt: Date.now() };
    Storage.saveBest(chart.key, result);
    showResult(result);
  }

  function showResult(result) {
    centerMsg.hidden = false;
    centerMsg.innerHTML = `
      <h2>결과</h2>
      <p class="stat">Score ${result.score}</p>
      <p class="hint">Max Combo ${result.maxCombo} · Accuracy ${result.accuracy.toFixed(1)}%</p>
      <p class="hint">Perfect ${result.counts.perfect} · Good ${result.counts.good} · Miss ${result.counts.miss}</p>
      <button id="playerRetry" class="btn primary">다시 플레이</button>
      <button id="playerExit" class="btn">나가기</button>
    `;
    el("playerRetry").onclick = () => start();
    el("playerExit").onclick = () => { Fullscreen.exit(); teardown(() => onDone()); };
  }

  function start() {
    Fullscreen.enter();
    score = 0; combo = 0; maxCombo = 0;
    counts = { perfect: 0, good: 0, miss: 0 };
    notes = chart.notes.map((n) => ({ ...n, judged: false }));
    heldPointers.clear();
    scoreEl.textContent = "0";
    comboEl.textContent = "0";
    centerMsg.hidden = true;
    video.currentTime = 0;
    video.play().catch(() => {});
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function init(selectedSource, selectedChart, callbacks) {
    source = selectedSource;
    chart = selectedChart;
    laneCount = chart.laneCount || 6;
    onDone = callbacks.onDone;

    video = el("playerVideo");
    canvas = el("playerCanvas");
    ctx = canvas.getContext("2d");
    lanesEl = el("playerLanes");
    scoreEl = el("playerScore");
    comboEl = el("playerCombo");
    toastEl = el("judgmentToast");
    centerMsg = el("playerCenterMsg");

    video.src = source.url;
    buildLanes();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const best = Storage.getBest(chart.key);
    centerMsg.hidden = false;
    centerMsg.innerHTML = `
      <h2>플레이</h2>
      <p class="hint">${best ? `Best Score ${best.score} · Accuracy ${best.accuracy.toFixed(1)}%` : "아직 기록이 없습니다"}</p>
      <button id="playerStart" class="btn primary">시작</button>
      <button id="playerExitTop" class="btn">나가기</button>
    `;
    el("playerStart").onclick = start;
    el("playerExitTop").onclick = () => { Fullscreen.exit(); teardown(() => onDone()); };
    el("playerBack").onclick = () => { Fullscreen.exit(); teardown(() => onDone()); };

    lanesEl.onpointerdown = onPointerDown;
    lanesEl.onpointerup = onPointerUp;
    lanesEl.onpointercancel = onPointerUp;
  }

  function teardown(after) {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener("resize", resizeCanvas);
    if (video) {
      video.pause();
      if (source && source.isBlob && video.src) URL.revokeObjectURL(video.src);
      video.removeAttribute("src");
      video.load();
    }
    lanesEl.onpointerdown = null;
    lanesEl.onpointerup = null;
    lanesEl.onpointercancel = null;
    if (after) after();
  }

  return { init };
})();
