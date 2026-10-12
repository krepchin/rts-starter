import { TILE, TEAM_COLORS, BUILDINGS } from '../data/stats.js';
import { drawBuildingArt } from './buildingArt.js';
import { getSprite, TANK_VARIANTS, INTERCEPTOR_VARIANTS, NATIVE_RIGHT } from './sprites.js';

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
    const vis = g.buildings.filter(b => b.team === 0 || fog.visibleAt(b.x, b.y) || b.seen).sort((a, b) => (a.ty + a.h) - (b.ty + b.h));
    for (const b of vis) { if (b.team !== 0) b.seen = true; this.drawBuilding(b, ui.selection.has(b), t); }
    const ground = g.units.filter(u => !u.isAir), air = g.units.filter(u => u.isAir);
    for (const u of [...ground, ...air]) if (u.team === 0 || fog.visibleAt(u.x, u.y)) this.drawUnit(u, ui.selection.has(u), t);
    for (const e of g.effects) {
      if (e.ping) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + (0.3 - e.t) * 40, 0, 7); ctx.stroke(); }
      else if (e.ion) { const k = e.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.shadowColor = '#9cf'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#dff'; ctx.fillRect(e.x - 10 * k, e.y - 900, 20 * k, 900); ctx.strokeStyle = '#9cf'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 - k), 0, 7); ctx.stroke(); ctx.fillStyle = '#9cf6'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, 7); ctx.fill(); ctx.restore(); }
      else if (e.sell) { ctx.strokeStyle = `rgba(200,200,180,${e.t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.6 - e.t), 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      else if (e.boom) { ctx.fillStyle = `rgba(255,${150 + e.t * 150 | 0},60,${e.t / 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - e.t), 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = e.t / 0.12; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
    }
    this.drawFog(x0, y0, x1, y1);
    if (ui.placing) this.drawPlacement(ui);
    if (ui.targeting) this.drawTargeting(ui);
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
  drawBuilding(b, sel, t) {
    const ctx = this.ctx, x = b.tx * TILE, y = b.ty * TILE, w = b.w * TILE, h = b.h * TILE;
    drawBuildingArt(ctx, b, t, this.g);
    this.hpBar(b, x, y - 6, w, sel);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 4]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      ctx.fillStyle = '#cfe'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(BUILDINGS[b.type].name, x + w / 2, y + h + 11);
      if (b.rally) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 4, 0, 7); ctx.stroke(); } }
    if (b.stats.superweapon && b.team === 0) { const f = b.charge / b.stats.superweapon.chargeTime; ctx.fillStyle = '#000a'; ctx.fillRect(x, y + h - 4, w, 4); ctx.fillStyle = f >= 1 ? '#fff' : '#9cf'; ctx.fillRect(x, y + h - 4, w * f, 4); }
  }
  drawUnit(u, sel, t) {
    const ctx = this.ctx, col = TEAM_COLORS[u.team], r = u.radius;
    if (u.type === 'tank' && this.drawTankSprite(u, sel, col, r)) return;
    if ((u.type === 'carrier' || u.type === 'interceptor') && this.drawAirSprite(u, sel, col, r, t)) return;
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
  // Cosmetic tank variants (cycled by unit id). Isometric art: flip horizontally by heading instead of rotating.
  drawTankSprite(u, sel, col, r) {
    const spr = getSprite(TANK_VARIANTS[u.id % 3], u.team); if (!spr) return false;
    const ctx = this.ctx, c = Math.cos(u.angle); if (Math.abs(c) > 0.2) u.faceRight = c > 0;
    const w = 38, h = w * spr.aspect;
    ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(u.x + 2, u.y + 4, w * 0.42, h * 0.3, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, w * 0.44, h * 0.32, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    ctx.save(); ctx.translate(u.x, u.y); if (u.faceRight) ctx.scale(-1, 1);
    ctx.drawImage(spr.img, -w / 2, 6 - h, w, h); ctx.restore();
    this.hpBar(u, u.x - r, u.y - h + 2, r * 2, sel);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, w * 0.5, h * 0.38, 0, 0, 7); ctx.stroke(); }
    return true;
  }
  // Air units: isometric art flipped by heading, hovering above a soft ground shadow.
  drawAirSprite(u, sel, col, r, t) {
    const name = u.type === 'carrier' ? 'carrier' : INTERCEPTOR_VARIANTS[u.id % INTERCEPTOR_VARIANTS.length];
    const spr = getSprite(name, u.team); if (!spr) return false;
    const ctx = this.ctx, c = Math.cos(u.angle); if (Math.abs(c) > 0.2) u.faceRight = c > 0;
    const big = u.type === 'carrier', w = big ? 72 : 22, h = w * spr.aspect, lift = big ? 16 : 10, bob = Math.sin(t * 2 + u.id) * (big ? 2 : 1.5);
    ctx.save(); ctx.filter = 'blur(3px)'; ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(u.x + 6, u.y + lift, w * 0.4, h * 0.25, 0, 0, 7); ctx.fill(); ctx.restore();
    if (big) { ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(u.x + 6, u.y + lift, w * 0.45, h * 0.3, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
    ctx.save(); ctx.translate(u.x, u.y + bob); if (u.faceRight !== !!NATIVE_RIGHT[name]) ctx.scale(-1, 1);
    ctx.drawImage(spr.img, -w / 2, -h / 2, w, h); ctx.restore();
    if (!big) { ctx.fillStyle = col; ctx.fillRect(u.x - 1.5, u.y + bob - h / 2 - 3, 3, 3); return true; } // team marker
    this.hpBar(u, u.x - w * 0.35, u.y + bob - h / 2 - 6, w * 0.7, sel);
    if (sel) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(u.x + 6, u.y + lift, w * 0.5, h * 0.36, 0, 0, 7); ctx.stroke(); }
    return true;
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
    const s = BUILDINGS[ui.placing], ht = ui.hoverTile, ok = this.g.canPlace(0, ui.placing, ht.x, ht.y), ctx = this.ctx;
    ctx.globalAlpha = 0.55; drawBuildingArt(ctx, { type: ui.placing, team: 0, tx: ht.x, ty: ht.y, w: s.w, h: s.h, stats: s, age: 9, aim: 1.57, charge: 0 }, performance.now() / 1000, null); ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? '#3f63' : '#f334'; ctx.strokeStyle = ok ? '#6f6' : '#f55';
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { ctx.fillRect((ht.x + x) * TILE + 1, (ht.y + y) * TILE + 1, TILE - 2, TILE - 2); }
    ctx.strokeRect(ht.x * TILE, ht.y * TILE, s.w * TILE, s.h * TILE);
  }
  drawTargeting(ui) {
    const ctx = this.ctx, p = ui.hoverWorld; if (!p) return; const r = 3 * TILE, t = performance.now() / 1000;
    ctx.strokeStyle = '#9cf'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = t * 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(p.x - 10, p.y); ctx.lineTo(p.x + 10, p.y); ctx.moveTo(p.x, p.y - 10); ctx.lineTo(p.x, p.y + 10); ctx.stroke(); ctx.lineWidth = 1;
  }
}
