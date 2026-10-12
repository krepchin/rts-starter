// v9 pencil-and-ink look (matches the approved concept sketch). Converts a canvas in place, once, at load time:
// warm graphite grays, ink outlines from luminance edges, cross-hatching in shadows, and a muted wash
// (team 0 = yellow ochre, team 1 = brick red; terrain = paper/sand). A little of the original colour is kept so
// Tiberium stays green and units stay readable.
export const INK = '#2b261e', PAPER = '#e2d5b4', PAPER_DARK = '#c9b78e';
const WASH = { 0: [1.0, 0.93, 0.70], 1: [1.0, 0.78, 0.68], paper: [1.0, 0.93, 0.76] };
export function sketchify(canvas, { wash = 0, keep = 0.3, ink = 1.3, hatch = true, lift = 0 } = {}) {
  const w = canvas.width, h = canvas.height; if (!w || !h) return canvas;
  const ctx = canvas.getContext('2d'); let id;
  try { id = ctx.getImageData(0, 0, w, h); } catch { return canvas; } // tainted / unsupported: leave as is
  const d = id.data, L = new Float32Array(w * h), W = WASH[wash] || WASH[0];
  for (let i = 0, p = 0; p < L.length; p++, i += 4) L[p] = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4; if (d[i + 3] === 0) continue;
    const l = L[p], xm = x > 0 ? L[p - 1] : l, xp = x < w - 1 ? L[p + 1] : l, ym = y > 0 ? L[p - w] : l, yp = y < h - 1 ? L[p + w] : l;
    const e = Math.min(255, Math.abs(xp - xm) + Math.abs(yp - ym));
    let g = 70 + l * 0.72 + lift;                                            // graphite tone, lifted toward paper
    if (hatch && l < 120 && (x + y) % 4 === 0) g -= 26;                      // hatching in shadows
    if (hatch && l < 70 && (x - y + 1000) % 4 === 0) g -= 22;                // cross-hatch in deep shadow
    g -= e * ink * 0.55;                                                     // ink outline
    const m = 1 - keep;
    d[i] = Math.max(0, Math.min(255, g * W[0] * m + d[i] * keep));
    d[i + 1] = Math.max(0, Math.min(255, g * W[1] * m + d[i + 1] * keep));
    d[i + 2] = Math.max(0, Math.min(255, g * W[2] * m + d[i + 2] * keep));
  }
  ctx.putImageData(id, 0, 0); return canvas;
}
