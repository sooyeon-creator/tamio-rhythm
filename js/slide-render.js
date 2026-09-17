// Draws a slide note as a staircase (straight down within a lane, then a
// square jump to the next lane) instead of one diagonal line, matching how
// the lane change is actually recorded: a sequence of discrete hops.
const SlideRender = (() => {
  function draw(ctx, note, now, { laneCenterX, yForTime, stroke, fill, lineWidth }) {
    const steps = note.path && note.path.length ? note.path : [{ lane: note.lane, time: note.time }];

    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    let x = laneCenterX(steps[0].lane);
    ctx.moveTo(x, yForTime(steps[0].time, now));
    for (let i = 1; i < steps.length; i++) {
      const jumpY = yForTime(steps[i].time, now);
      ctx.lineTo(x, jumpY); // straight run down within the current lane
      x = laneCenterX(steps[i].lane);
      ctx.lineTo(x, jumpY); // square jump to the next lane
    }

    const endY = yForTime(note.holdEnd, now);
    ctx.lineTo(x, endY);
    const endX = laneCenterX(note.toLane);
    if (endX !== x) ctx.lineTo(endX, endY); // only for legacy notes saved without a path
    ctx.stroke();

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(laneCenterX(steps[0].lane), yForTime(steps[0].time, now), lineWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  return { draw };
})();
