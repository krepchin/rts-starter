import { TILE, TEAM_COLORS, BUILDINGS } from '../data/stats.js';

// Placeholder vector art. Swap draw* functions for sprites later.
export class Renderer {
  constructor(canvas, game, camera) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.cam = camera; this.dpr = 1; }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr));
    this.cam.resize(r.width, r.height);
  }
  render(ui) {
    const { ctx, g, cam } = this, fog = g.fog;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0a1016'; ctx.fillRect(0, 0, cam.vw, cam.vh);
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    const x0 = Math.max(0, (cam.x / TILE) | 0), y0 = Math.max(0, (cam.y / TILE) | 0);
    const x1 = Math.min(g.map.w, x0 + Math.ceil(cam.vw / TILE) + 2), y1 = Math.min(g.map.h, y0 + Math.ceil(cam.vh / TILE) + 2);
    const t = performance.now() / 1000;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = g.map.idx(x, y);
      ctx.fillStyle = ['#18221c', '#1a251e', '#172019', '#1c2620'][g.map.ground[i]];
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      const amt = g.map.tib[i];
      if (amt > 5) this.drawCrystals(x, y, amt / 500, t);
    }
    ctx.strokeStyle = '#ffffff08'; ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(x * TILE, y0 * TILE); ctx.lineTo(x * TILE, y1 * TILE); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(x0 * TILE, y * TILE); ctx.lineTo(x1 * TILE, y * TILE); }
    ctx.stroke();
    for (const b of g.buildings) if (b.team === 0 || fog.visibleAt(b.x, b.y) || b.seen) { if (b.team !== 0) b.seen = true; this.drawBuilding(b, ui.selection.has(b)); }
    const ground = g.units.filter(u => !u.isAir), air = g.units.filter(u => u.isAir);
    for (const u of [...ground, ...air]) if (u.team === 0 || fog.visibleAt(u.x, u.y)) this.drawUnit(u, ui.selection.has(u), t);
    for (const e of g.effects) {
      if (e.ping) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + (0.3 - e.t) * 40, 0, 7); ctx.stroke(); }
      else if (e.boom) { ctx.fillStyle = `rgba(255,${150 + e.t * 150 | 0},60,${e.t / 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - e.t), 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = e.t / 0.12; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
    }
    this.drawFog(x0, y0, x1, y1);
    if (ui.placing) this.drawPlacement(ui);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (ui.box) { const b = ui.box; ctx.strokeStyle = '#6f6'; ctx.setLineDash([4, 3]); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.setLineDash([]); }
  }
  drawCrystals(tx, ty, f, t) {
    const ctx = this.ctx, n = 1 + Math.round(f * 3), cx = tx * TILE, cy = ty * TILE;
    ctx.shadowColor = '#3f6'; ctx.shadowBlur = 8 + Math.sin(t * 2 + tx + ty) * 3;
    for (let k = 0; k < n; k++) {
      const ox = cx + 6 + ((k * 37 + tx * 13) % 20), oy = cy + 8 + ((k * 23 + ty * 7) % 16), h = 6 + f * 8;
      ctx.fillStyle = k % 2 ? '#5f9' : '#2e6';
      ctx.beginPath(); ctx.moveTo(ox, oy - h); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 3); ctx.lineTo(ox - 4, oy); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  drawBuilding(b, sel) {
    const ctx = this.ctx, col = TEAM_COLORS[b.team], x = b.tx * TILE, y = b.ty * TILE, w = b.w * TILE, h = b.h * TILE;
    ctx.fillStyle = '#1b2733'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.lineWidth = 1;
    ctx.fillStyle = col; ctx.globalAlpha = 0.35;
    const icon = { cy: () => ctx.fillRect(x + w / 2 - 14, y + h / 2 - 14, 28, 28), power: () => { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 14, 0, 7); ctx.fill(); },
      refinery: () => ctx.fillRect(x + 8, y + 8, w - 16, h / 2 - 8), barracks: () => ctx.fillRect(x + 10, y + 10, w - 20, h - 20),
      factory: () => ctx.fillRect(x + 8, y + h - 24, w - 16, 16), airfield: () => ctx.fillRect(x + 8, y + h / 2 - 3, w - 16, 6),
      turret: () => { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 10, 0, 7); ctx.fill(); } };
    icon[b.type]?.(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#cfe'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center';
    if (b.w > 1) ctx.fillText(BUILDINGS[b.type].name.split(' ')[0].toUpperCase(), x + w / 2, y + h / 2 + 4);
    this.hpBar(b, x, y - 6, w, sel);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h); if (b.rally) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); } }
  }
  drawUnit(u, sel, t) {
    const ctx = this.ctx, col = TEAM_COLORS[u.team], r = u.radius;
    ctx.save(); ctx.translate(u.x, u.y);
    if (u.isAir) { ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(6, 10, r, r * 0.6, 0, 0, 7); ctx.fill(); }
    ctx.rotate(u.angle);
    ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.shadowColor = col; ctx.shadowBlur = u.isAir ? 10 : 4;
    ctx.beginPath();
    switch (u.type) {
      case 'infantry': ctx.arc(0, 0, r, 0, 7); break;
      case 'tank': ctx.rect(-r, -r * 0.7, r * 2, r * 1.4); break;
      case 'harvester': ctx.rect(-r, -r * 0.8, r * 2, r * 1.6); break;
      case 'carrier': ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r, r * 0.8); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(-r, -r * 0.8); ctx.closePath(); break;
      case 'interceptor': ctx.moveTo(r * 1.5, 0); ctx.lineTo(-r, r); ctx.lineTo(-r, -r); ctx.closePath(); break;
    }
    ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    if (u.type === 'tank') { ctx.fillStyle = '#ddd'; ctx.fillRect(0, -2, r + 5, 4); }
    if (u.type === 'harvester') { ctx.fillStyle = '#4f8'; ctx.fillRect(-r + 3, -4, (r * 2 - 6) * (u.load / u.stats.capacity), 8); }
    if (u.type === 'carrier') { ctx.fillStyle = '#cff'; ctx.beginPath(); ctx.arc(-r * 0.2, 0, 4 + Math.sin(t * 4), 0, 7); ctx.fill(); }
    ctx.restore();
    if (u.type !== 'interceptor') this.hpBar(u, u.x - r, u.y - r - 7, r * 2, sel);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(u.x, u.y, r + 4, 0, 7); ctx.stroke(); }
  }
  hpBar(e, x, y, w, always) {
    if (!always && e.hp >= e.stats.hp) return;
    const f = e.hp / e.stats.hp, ctx = this.ctx;
    ctx.fillStyle = '#000a'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = f > 0.6 ? '#4f6' : f > 0.3 ? '#fd4' : '#f44'; ctx.fillRect(x, y, w * f, 4);
  }
  drawFog(x0, y0, x1, y1) {
    const g = this.g; if (!g.fog.enabled) return; const ctx = this.ctx, v = g.fog.v;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const s = v[g.map.idx(x, y)]; if (s === 2) continue;
      ctx.fillStyle = s === 0 ? '#000' : '#0008'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  drawPlacement(ui) {
    const s = BUILDINGS[ui.placing], ok = this.g.canPlace(0, ui.placing, ui.hoverTile.x, ui.hoverTile.y);
    this.ctx.fillStyle = ok ? '#3f63' : '#f333'; this.ctx.strokeStyle = ok ? '#6f6' : '#f55';
    this.ctx.fillRect(ui.hoverTile.x * TILE, ui.hoverTile.y * TILE, s.w * TILE, s.h * TILE);
    this.ctx.strokeRect(ui.hoverTile.x * TILE, ui.hoverTile.y * TILE, s.w * TILE, s.h * TILE);
  }
}
