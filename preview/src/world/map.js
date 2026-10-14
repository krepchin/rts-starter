import { TILE, ECONOMY } from '../data/stats.js?v=10.3p';

// Simple tile map: terrain + tiberium amount per tile. Tiberium slowly regrows and spreads.
export class GameMap {
  constructor(w, h, seed = 7) {
    this.w = w; this.h = h;
    this.tib = new Float32Array(w * h);
    this.tibMax = new Float32Array(w * h); // >0 marks a field tile that can regrow
    this.rng = mulberry(seed);
    this.ground = new Uint8Array(w * h).map(() => (this.rng() * 4) | 0);
  }
  get pxW() { return this.w * TILE; } get pxH() { return this.h * TILE; }
  idx(tx, ty) { return ty * this.w + tx; }
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  addField(cx, cy, r) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const tx = cx + x, ty = cy + y;
      if (!this.inside(tx, ty) || x * x + y * y > r * r || this.rng() < 0.2) continue;
      const i = this.idx(tx, ty);
      this.tibMax[i] = ECONOMY.tiberiumPerTile; this.tib[i] = ECONOMY.tiberiumPerTile * (0.5 + this.rng() * 0.5);
    }
  }
  update(dt) {
    for (let i = 0; i < this.tib.length; i++) {
      if (this.tibMax[i] > 0 && this.tib[i] < this.tibMax[i]) this.tib[i] = Math.min(this.tibMax[i], this.tib[i] + ECONOMY.regrowPerSec * dt);
    }
  }
  harvest(tx, ty, amt) {
    const i = this.idx(tx, ty); const got = Math.min(amt, this.tib[i]); this.tib[i] -= got; return got;
  }
  nearestTiberium(px, py, maxR = 40) {
    const cx = (px / TILE) | 0, cy = (py / TILE) | 0;
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !this.inside(x, y)) continue;
        if (this.tib[this.idx(x, y)] > 40) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = { tx: x, ty: y }; } }
      }
      if (best) return best;
    }
    return null;
  }
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
