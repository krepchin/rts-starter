import { TILE } from '../data/stats.js?v=10.0';
import { mulberry } from './map.js?v=10.0';

// Procedural ground, pre-rendered lazily into 512px offscreen chunks (cheap to blit; phone-friendly).
// Low-res colour field (biome noise: dirt / grass / rock, elevation shading, Tiberium staining around fields)
// is upscaled smoothly, then grain, soil patches, rock outcrops, cracks, pebbles and crystal shards are drawn on top.
const CHUNK = 512, CELL = 4;
function hash(x, y, s) { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 3) { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 17); amp *= 0.5; fr *= 2; } return f / (1 - Math.pow(0.5, oct)); }
// v9 painted desert: warm sand, darker packed dirt, ochre rock; tiberium-stained ground stays olive
const DIRT = [168, 122, 78], GRASS = [140, 100, 62], ROCK = [124, 98, 74], STAIN = [104, 112, 58];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class Terrain {
  constructor(map, seed = 11) {
    this.map = map; this.seed = seed; this.chunks = new Map();
    const w = map.w, h = map.h, st = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const tx = x + dx, ty = y + dy; if (map.inside(tx, ty) && map.tibMax[map.idx(tx, ty)] > 0) s += 1 / (1 + dx * dx + dy * dy);
      }
      st[y * w + x] = Math.min(1, s / 4);
    }
    this.stain = st; this.grain = this.makeGrain();
  }
  makeGrain() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), img = x.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { const v = hash(i % 128, (i / 128) | 0, 99) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 28; }
    x.putImageData(img, 0, 0); return c;
  }
  stainAt(px, py) {
    const m = this.map, fx = px / TILE - 0.5, fy = py / TILE - 0.5, x0 = Math.max(0, Math.min(m.w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(m.h - 1, Math.floor(fy)));
    const x1 = Math.min(m.w - 1, x0 + 1), y1 = Math.min(m.h - 1, y0 + 1), tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0)), S = this.stain;
    return (S[y0 * m.w + x0] * (1 - tx) + S[y0 * m.w + x1] * tx) * (1 - ty) + (S[y1 * m.w + x0] * (1 - tx) + S[y1 * m.w + x1] * tx) * ty;
  }
  chunk(cx, cy) {
    const key = cx + ',' + cy; let c = this.chunks.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = CHUNK; const ctx = c.getContext('2d'), s = this.seed;
    const n = CHUNK / CELL + 2, low = document.createElement('canvas'); low.width = low.height = n;
    const lx = low.getContext('2d'), img = lx.createImageData(n, n), ox = cx * CHUNK, oy = cy * CHUNK;
    const elev = (X, Y) => fbm(X / 220, Y / 220, s + 5, 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const X = ox + (i - 1) * CELL, Y = oy + (j - 1) * CELL;
      const biome = fbm(X / 360, Y / 360, s, 3), grass = Math.max(0, Math.min(1, (biome - 0.5) * 4)), rock = Math.max(0, Math.min(1, (0.4 - biome) * 5));
      let col = mix(mix(DIRT, GRASS, grass), ROCK, rock);
      const det = fbm(X / 40, Y / 40, s + 9, 2), e = elev(X, Y), shade = (elev(X - 6, Y - 6) - elev(X + 6, Y + 6)) * 4;
      const k = (0.86 + det * 0.24) * (0.78 + e * 0.18 + shade); col = [col[0] * k, col[1] * k, col[2] * k];
      const st = this.stainAt(X, Y); if (st > 0) col = mix(col, STAIN, st * 0.55);
      const o = (j * n + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    lx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(low, 1, 1, n - 2, n - 2, 0, 0, CHUNK, CHUNK);
    if (this.grain) { ctx.fillStyle = ctx.createPattern(this.grain, 'repeat'); ctx.globalCompositeOperation = 'overlay'; ctx.fillRect(0, 0, CHUNK, CHUNK); ctx.globalCompositeOperation = 'source-over'; }
    const r = mulberry((cx * 7919 + cy * 104729 + s) | 0);
    for (let k = 0; k < 14; k++) { const x = r() * CHUNK, y = r() * CHUNK, rad = 10 + r() * 40, dark = r() < 0.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, dark ? 'rgba(20,16,10,0.22)' : 'rgba(140,130,100,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, 7); ctx.fill(); }
    for (let k = 0; k < 10; k++) { const x = r() * CHUNK, y = r() * CHUNK; if (fbm((ox + x) / 360, (oy + y) / 360, s, 3) > 0.45 && r() < 0.7) continue;
      const rad = 5 + r() * 9; ctx.beginPath();
      for (let p = 0; p < 7; p++) { const a = p / 7 * 6.283, rr = rad * (0.7 + r() * 0.5); ctx[p ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75); }
      ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.save(); ctx.translate(2, 3); ctx.fill(); ctx.restore();
      ctx.fillStyle = `rgb(${90 + r() * 25 | 0},${90 + r() * 20 | 0},${86 + r() * 20 | 0})`; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - rad * 0.25, y - rad * 0.25, rad * 0.4, rad * 0.25, 0, 0, 7); ctx.fill(); }
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) { let x = r() * CHUNK, y = r() * CHUNK, a = r() * 6.283; ctx.strokeStyle = 'rgba(15,12,8,0.45)'; ctx.lineWidth = 1 + r();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let p = 0; p < 6; p++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * (6 + r() * 8); y += Math.sin(a) * (6 + r() * 8); ctx.lineTo(x, y);
        if (r() < 0.25) { ctx.lineTo(x + Math.cos(a + 1.3) * 7, y + Math.sin(a + 1.3) * 7); ctx.moveTo(x, y); } }
      ctx.stroke(); }
    for (let k = 0; k < 140; k++) { const x = r() * CHUNK, y = r() * CHUNK, rad = 0.8 + r() * 1.8, l = 70 + r() * 60 | 0;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 0.8, y + 0.8, rad, rad * 0.7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${l},${l - 4},${l - 10})`; ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.7, 0, 0, 7); ctx.fill(); }
    for (let k = 0; k < 80; k++) { const x = r() * CHUNK, y = r() * CHUNK, st = this.stainAt(ox + x, oy + y); if (st < 0.25 || r() > st) continue;
      ctx.fillStyle = `rgba(90,230,120,${0.25 + st * 0.35})`; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 1.5, y); ctx.lineTo(x, y + 1); ctx.lineTo(x - 1.5, y); ctx.fill(); }
    // v9 ridges: soft eroded ridge lines (lit top edge, shadowed lower edge) + tyre-like dirt streaks
    for (let k = 0; k < 3; k++) { let x = r() * CHUNK, y = r() * CHUNK, a = r() * 0.8 - 0.4; const len = 6 + (r() * 6 | 0), pts = [];
      for (let p = 0; p < len; p++) { pts.push([x, y]); a += (r() - 0.5) * 0.5; x += Math.cos(a) * 10; y += Math.sin(a) * 4; }
      for (const [dy, col, w] of [[2.5, 'rgba(70,45,25,0.35)', 4], [0, 'rgba(235,200,150,0.30)', 2.5]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        pts.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py + dy)); ctx.stroke(); } }
    this.chunks.set(key, c); return c;
  }
  draw(ctx, x0, y0, x1, y1) {
    for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor((y1 - 1) / CHUNK); cy++)
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor((x1 - 1) / CHUNK); cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= this.map.pxW || cy * CHUNK >= this.map.pxH) continue;
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK, cy * CHUNK);
      }
  }
}
