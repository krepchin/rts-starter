// Fixed-timestep simulation with requestAnimationFrame rendering.
export function startLoop(update, render, step = 1 / 30) {
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    // Schedule the next frame first and contain errors, so one bad frame can never freeze the game.
    requestAnimationFrame(frame);
    try { while (acc >= step) { update(step); acc -= step; } render(); }
    catch (e) { acc = 0; if (!frame.warned) { frame.warned = true; console.error('frame error (game continues):', e); } }
  }
  requestAnimationFrame(frame);
}
