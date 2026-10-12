// Fixed-timestep simulation with requestAnimationFrame rendering.
export function startLoop(update, render, step = 1 / 30) {
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    while (acc >= step) { update(step); acc -= step; }
    render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
