// v10.0 staged construction (non-organic structures): foundation -> walls -> roof. Each band of the finished art appears and
// settles straight down into place (ease-in-out, no scaling, no overshoot, no rebound); dust kicks up where a band lands; the
// contact shadow widens smoothly with progress. Only runs during the first BUILD_T seconds of a building's life.
export const BUILD_T = 2.4;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const clamp = k => Math.max(0, Math.min(1, k));
// bands as fractions of the drawn height measured up from the footprint's bottom edge; art may extend ~1.2 H above the footprint
const BANDS = [[0, 0.32, 0.0, 0.34], [0.32, 0.72, 0.30, 0.68], [0.72, 1.0, 0.62, 1.0]]; // [from, to, startP, endP]
export function drawConstruction(ctx, b, t, draw, TILE) {
  const X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE, P = clamp((b.age ?? 9) / BUILD_T), base = Y + H + 2, tall = H * 1.55;
  // smooth contact shadow + scaffold pad
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.18 * ease(P)})`; ctx.beginPath(); ctx.ellipse(X + W / 2, Y + H - 2, W * (0.35 + 0.2 * ease(P)), H * 0.2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(70,64,52,0.55)'; ctx.setLineDash([3, 3]); ctx.strokeRect(X + 1, Y + 1, W - 2, H - 2); ctx.setLineDash([]); ctx.restore();
  const real = b.age; b.age = 9; // the bands show the finished art; only clipping + offset change
  for (const [f0, f1, s, e] of BANDS) {
    const k = ease(clamp((P - s) / (e - s))); if (k <= 0) continue;
    const yTop = base - tall * f1, yBot = base - tall * f0, drop = (1 - k) * 10; // lowered into place from 10 px above
    ctx.save(); ctx.beginPath(); ctx.rect(X - W, yTop + drop, W * 3, yBot - yTop + 0.5); ctx.clip(); ctx.globalAlpha = 0.35 + 0.65 * k; ctx.translate(0, -drop);
    draw(); ctx.restore();
    if (k < 1) { // settling dust where this band lands
      ctx.save(); for (let i = 0; i < 5; i++) { const a = (i * 2.4 + (b.id || 0)) % 6.28, r = 3 + (1 - k) * 5, dx = X + W * (0.15 + 0.7 * (i / 4)), dy = Math.min(yBot, Y + H) - 2 - (1 - k) * 4 * Math.abs(Math.sin(a));
        ctx.fillStyle = `rgba(190,165,125,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(dx + Math.cos(a) * (1 - k) * 6, dy, r, 0, 7); ctx.fill(); } ctx.restore(); }
  }
  b.age = real;
}
