import { TEAM_COLORS } from '../data/stats.js';

export class Minimap {
  constructor(canvas, game, camera) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.cam = camera;
    const go = e => { const r = canvas.getBoundingClientRect(); this.cam.centerOn((e.clientX - r.left) / r.width * game.map.pxW, (e.clientY - r.top) / r.height * game.map.pxH); };
    let drag = false;
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); drag = true; canvas.setPointerCapture?.(e.pointerId); go(e); });
    canvas.addEventListener('pointermove', e => { if (drag) go(e); });
    canvas.addEventListener('pointerup', () => drag = false); canvas.addEventListener('pointercancel', () => drag = false);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  render() {
    const { ctx, g } = this, m = g.map, sx = this.c.width / m.w, sy = this.c.height / m.h, fog = g.fog;
    ctx.fillStyle = '#0d1612'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    ctx.fillStyle = '#3e6';
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tib[m.idx(x, y)] > 5 && fog.v[m.idx(x, y)]) ctx.fillRect(x * sx, y * sy, sx, sy);
    for (const b of g.buildings) if (b.team === 0 || b.seen) { ctx.fillStyle = TEAM_COLORS[b.team]; ctx.fillRect(b.tx * sx, b.ty * sy, b.w * sx, b.h * sy); }
    for (const u of g.units) if (u.team === 0 || fog.visibleAt(u.x, u.y)) { ctx.fillStyle = TEAM_COLORS[u.team]; ctx.fillRect(u.x / 32 * sx - 1, u.y / 32 * sy - 1, 2.5, 2.5); }
    ctx.fillStyle = '#0007';
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!fog.v[m.idx(x, y)]) ctx.fillRect(x * sx, y * sy, sx + .5, sy + .5);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(this.cam.x / 32 * sx, this.cam.y / 32 * sy, this.cam.vw / 32 * sx, this.cam.vh / 32 * sy);
  }
}
