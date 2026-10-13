import { TILE } from '../data/stats.js?v=10.0';
// Simple fog of war for one team: 0 = unexplored, 1 = explored, 2 = visible this frame.
export class Fog {
  constructor(map, team) { this.map = map; this.team = team; this.v = new Uint8Array(map.w * map.h); this.enabled = true; }
  update(entities) {
    const v = this.v; for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
    for (const e of entities) {
      if (e.team !== this.team || e.dead) continue;
      const r = e.stats.sight, cx = (e.x / TILE) | 0, cy = (e.y / TILE) | 0;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r && this.map.inside(cx + x, cy + y)) v[this.map.idx(cx + x, cy + y)] = 2;
    }
  }
  visibleAt(px, py) { if (!this.enabled) return true; const tx = (px / TILE) | 0, ty = (py / TILE) | 0;
    return this.map.inside(tx, ty) && this.v[this.map.idx(tx, ty)] === 2; }
}
