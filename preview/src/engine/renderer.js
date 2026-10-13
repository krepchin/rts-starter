import { ME } from './local.js?v=10.2p2';
import { TILE, TEAM_COLORS, BUILDINGS } from '../data/stats.js?v=10.2p2';
import { drawBuildingArt } from './buildingArt.js?v=10.2p2';
import { Terrain } from '../world/terrain.js?v=10.2p2';
import { drawMobileBase } from './mcvArt.js?v=10.2p2';
import { drawFactionUnit, drawOrganic, drawFx, drawZone, isFactionArt, drawAlienBuilding, isAlienBuilding } from './artReptile.js?v=10.2p2';
import { drawMorphing, drawWall, drawGate, drawTurret, drawTrooper, drawCrystalCluster, drawDropship, SEL, MUZZLE } from './art9.js?v=10.2p2';
import { FORMATION } from '../entities/mcv.js?v=10.2p2';
import { drawJet, drawBomber, drawRepairGlint } from './art10.js?v=10.2p2';
import { getSprite, TANK_VARIANTS, INTERCEPTOR_VARIANTS, NATIVE_RIGHT } from './sprites.js?v=10.2p2';

// Placeholder vector art. Swap draw* functions for sprites later.
export class Renderer {
  constructor(canvas, game, camera) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.cam = camera; this.dpr = 1; this.terrain = new Terrain(game.map); }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr));
    this.cam.resize(r.width, r.height);
  }
  render(ui) {
    const { ctx, g, cam } = this, fog = g.fog;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#5a4026'; ctx.fillRect(0, 0, cam.vw, cam.vh);
    const sh = g.shake || 0, shx = sh ? (Math.random() - .5) * sh * 2 : 0, shy = sh ? (Math.random() - .5) * sh * 2 : 0; // footfall / blast screen shake
    ctx.translate(-Math.round(cam.x) + shx, -Math.round(cam.y) + shy);
    const x0 = Math.max(0, (cam.x / TILE) | 0), y0 = Math.max(0, (cam.y / TILE) | 0);
    const x1 = Math.min(g.map.w, x0 + Math.ceil(cam.vw / TILE) + 2), y1 = Math.min(g.map.h, y0 + Math.ceil(cam.vh / TILE) + 2);
    const t = performance.now() / 1000;
    this.terrain.draw(ctx, cam.x, cam.y, cam.x + cam.vw, cam.y + cam.vh); // pre-rendered ground chunks
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = g.map.idx(x, y);
      const amt = g.map.tib[i];
      if (amt > 5) drawCrystalCluster(ctx, x, y, amt / 500, t);
    }
    for (const d of g.decals) { // scorch decals under everything
      const a = Math.min(1, d.t / 4) * 0.55; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.fillStyle = `rgba(30,22,14,${a})`;
      ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r * 0.55, 0, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(20,14,8,${a})`; ctx.beginPath(); ctx.ellipse(1, 0, d.r * 0.5, d.r * 0.3, 0.4, 0, 7); ctx.fill(); ctx.restore(); }
    for (const z of g.zones) drawZone(ctx, z, t);
    const vis = g.buildings.filter(b => b.team === ME || fog.visibleAt(b.x, b.y) || b.seen).sort((a, b) => (a.ty + a.h) - (b.ty + b.h));
    for (const b of vis) { if (b.team !== ME) b.seen = true; this.drawBuilding(b, ui.selection.has(b), t); }
    const ground = g.units.filter(u => !u.isAir), air = g.units.filter(u => u.isAir);
    for (const u of [...ground, ...air]) if (u.team === ME || fog.visibleAt(u.x, u.y)) this.drawUnit(u, ui.selection.has(u), t);
    for (const r of g.rockets) { // painted rocket: flame glow, body, fins, nose
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      const fl = 6 + Math.random() * 4, gr = ctx.createRadialGradient(-6, 0, 0, -6, 0, fl + 4); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.7)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(-7, 0, fl + 3, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5b5e55'; ctx.fillRect(-6, -1.6, 10, 3.2); ctx.fillStyle = '#8b8e83'; ctx.fillRect(-6, -1.6, 10, 1);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(1, -1.6, 1.5, 3.2); ctx.fillStyle = '#2c2d28'; ctx.beginPath(); ctx.moveTo(4, -1.6); ctx.lineTo(7.5, 0); ctx.lineTo(4, 1.6); ctx.fill();
      ctx.fillStyle = '#3a3c36'; ctx.beginPath(); ctx.moveTo(-6, -1.5); ctx.lineTo(-8.5, -4); ctx.lineTo(-4, -1.5); ctx.moveTo(-6, 1.5); ctx.lineTo(-8.5, 4); ctx.lineTo(-4, 1.5); ctx.fill();
      ctx.restore(); }
    for (const e of g.effects) {
      if (e.ping) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1, 4 + (0.3 - e.t) * 40), 0, 7); ctx.stroke(); }
      else if (e.ion) { const k = e.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.shadowColor = '#9cf'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#dff'; ctx.fillRect(e.x - 10 * k, e.y - 900, 20 * k, 900); ctx.strokeStyle = '#9cf'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 - k), 0, 7); ctx.stroke(); ctx.fillStyle = '#9cf6'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, 7); ctx.fill(); ctx.restore(); }
      else if (e.sell) { ctx.strokeStyle = `rgba(200,200,180,${e.t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.6 - e.t), 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      else if (e.fx && !e.rocket) drawFx(ctx, e, t);
      else if (e.rocket && this.g.rockets) { /* drawn as a real projectile (drawRockets) */ }
      else if (e.bolt || e.rocket) { const k = 1 - e.t / 0.25, px = e.x1 + (e.x2 - e.x1) * Math.min(1, k * 1.6), py = e.y1 + (e.y2 - e.y1) * Math.min(1, k * 1.6) - Math.sin(Math.min(1, k * 1.6) * Math.PI) * (e.rocket ? 14 : 4);
        ctx.save(); ctx.shadowColor = e.bolt ? '#7f3' : '#fa6'; ctx.shadowBlur = 10; ctx.fillStyle = e.bolt ? '#c8ff7a' : '#ffd08a'; ctx.beginPath(); ctx.arc(px, py, e.bolt ? 3.5 : 2.5, 0, 7); ctx.fill();
        if (e.rocket) { ctx.fillStyle = 'rgba(200,200,190,0.5)'; ctx.beginPath(); ctx.arc(px - (e.x2 - e.x1) * 0.06, py - (e.y2 - e.y1) * 0.06, 3, 0, 7); ctx.fill(); }
        if (k > 0.6) { ctx.globalAlpha = (1 - k) * 2.5; ctx.beginPath(); ctx.arc(e.x2, e.y2, 8 * k, 0, 7); ctx.fill(); } ctx.restore(); }
      else if (e.dustRing) { const k = 1 - e.t / 0.7; ctx.strokeStyle = `rgba(200,165,115,${(1 - k) * 0.8})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (0.4 + k), e.r * 0.4 * (0.4 + k), 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      else if (e.part) { ctx.globalAlpha = Math.max(0, e.t / e.life); ctx.fillStyle = e.color; if (e.glow) { ctx.shadowColor = e.color; ctx.shadowBlur = 6; }
        ctx.beginPath(); ctx.arc(e.x, e.y, e.grow ? e.size + e.grow * (1 - e.t / e.life) : e.size * (e.glow ? 1 : 1.6 - e.t / e.life), 0, 7); if (e.smoke) ctx.globalAlpha *= 0.55; ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      else if (e.flash) { const k = e.t / 0.18; ctx.fillStyle = `rgba(255,240,190,${k * 0.85})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.3 - k * 0.5), 0, 7); ctx.fill(); }
      else if (e.erupt) { const k = e.t / 0.9; ctx.strokeStyle = `rgba(160,120,70,${k})`; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (1.2 - k * 0.6), e.r * 0.45 * (1.2 - k * 0.6), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = `rgba(255,200,90,${k * 0.6})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 0.5 * k, e.r * 0.2 * k, 0, 0, 7); ctx.fill(); ctx.lineWidth = 1; }
      else if (e.boom) { ctx.fillStyle = `rgba(255,${150 + e.t * 150 | 0},60,${e.t / 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - e.t), 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = e.t / 0.12; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
    }
    this.drawFog(x0, y0, x1, y1);
    if (ui.placing && ui.wallDrag) this.drawWallLine(ui); else if (ui.placing) this.drawPlacement(ui);
    if (ui.targeting) this.drawTargeting(ui);
    if (ui.deploying) this.drawDeploy(ui);
    if (ui.burrowing) this.drawBurrow(ui);
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
    if (b.morph || b.unfold) { drawMorphing(ctx, b, t, this.g); return; } // v9 staged transform / reverse unfold
    if (b.stats.wall) drawWall(ctx, b, t, this.g); else if (b.stats.gate) drawGate(ctx, b, t, this.g); else if (b.type === 'turret') drawTurret(ctx, b, t, this.g);
    else if (b.stats.faction === 'reptile') drawOrganic(ctx, b, t);
    else if (isAlienBuilding(b.stats)) drawAlienBuilding(ctx, b, t);
    else drawBuildingArt(ctx, b, t, this.g);
    if (!b.stats.wall || sel || b.hp < b.stats.hp) this.hpBar(b, x, y - 6, w, sel);
    for (const c of this.g.charges) if (c.b === b) { const on = Math.sin(t * (20 - c.t * 3)) > 0; ctx.fillStyle = on ? '#f33' : '#600'; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(c.t), b.x, b.y - 6); }
    if (sel) { ctx.strokeStyle = SEL; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(b.x, y + h * 0.62, w * 0.62, h * 0.42, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#cfe'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(BUILDINGS[b.type].name, x + w / 2, y + h + 11);
      if (b.rally) { ctx.strokeStyle = '#6f6'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 4, 0, 7); ctx.stroke(); } }
    if (b.stats.superweapon && b.team === ME) { const f = b.charge / b.stats.superweapon.chargeTime; ctx.fillStyle = '#000a'; ctx.fillRect(x, y + h - 4, w, 4); ctx.fillStyle = f >= 1 ? '#fff' : '#9cf'; ctx.fillRect(x, y + h - 4, w * f, 4); }
  }
  drawUnit(u, sel, t) {
    const ctx = this.ctx, col = TEAM_COLORS[u.team], r = u.radius;
    if (u.beingRepaired > 0 && !u.stats.inf && u.type !== 'jet' && u.type !== 'bomber') drawRepairGlint(ctx, u.x, u.y - r - 4, t);
    if (u.carried) { drawMobileBase(ctx, u, sel, t); return; }
    if (isFactionArt(u.type)) { const ctx = this.ctx, top = drawFactionUnit(ctx, u, t, ME); if (top === null) return;
      const rr = Math.max(8, u.radius * 1.2); if (sel) { ctx.strokeStyle = SEL; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, rr, rr * 0.36, 0, 0, 7); ctx.stroke(); }
      if (u.team !== ME || sel || u.hp < u.stats.hp) this.hpBar(u, u.x - rr, top - 8, rr * 2, sel); return; }
    if (u.stats.inf) { this.drawSoldier(u, sel, col, t); return; }
    if ((u.type === 'tank' || u.type === 'harvester') && this.drawTankSprite(u, sel, col, r)) return;
    if (u.type === 'jet' || u.type === 'bomber') { this.drawStrikeCraft(u, sel, col, t); return; }
    if (u.type === 'carrier' && this.drawCarrierTD(u, sel, col, t)) return;
    if (u.type === 'dropship') { const ctx = this.ctx, { lift, hidden } = drawDropship(ctx, u, t, ME); if (hidden) return;
      if (sel) { ctx.strokeStyle = SEL; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 32, 10, 0, 0, 7); ctx.stroke(); }
      if (u.team === ME || sel || u.hp < u.stats.hp) this.hpBar(u, u.x - 18, u.y - lift - 24, 36, sel);
      if (u.team === ME) { const cap = u.stats.capacity, used = u.used; for (let i = 0; i < cap; i++) { ctx.fillStyle = i < used ? '#c8ff7a' : '#0008'; ctx.fillRect(u.x - 18 + i * 4.6, u.y - lift - 19, 3.6, 3); }
        ctx.fillStyle = '#4fd8ff'; ctx.fillRect(u.x - 18, u.y - lift - 15, 36 * u.energy / u.stats.energy, 2); }
      return; }
    if ((u.type === 'carrier' || u.type === 'interceptor') && this.drawAirSprite(u, sel, col, r, t)) return;
    ctx.save(); ctx.translate(u.x, u.y);
    if (u.isAir) { ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(6, 10, r, r * 0.6, 0, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 1.1, r * 0.55, 0, 0, 7); ctx.fill(); }
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
    if (!u.carrier) this.hpBar(u, u.x - r, u.y - r - 7, r * 2, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.arc(u.x, u.y, r + 4, 0, 7); ctx.stroke(); }
  }
  // v9.2 carrier: top-down art cut from Kent's approved concept (steel-blue deck, sand camo), rotated to heading, with
  // the aft island tower, glowing blue thruster pods, a soft ground shadow and a launch strobe on the deck.
  drawCarrierTD(u, sel, col, t) {
    const spr = getSprite('carrier_td', u.team); if (!spr) return false;
    const ctx = this.ctx, L = 96, W = L * spr.aspect, lift = 18, bob = Math.sin(t * 1.6 + u.id) * 1.5, a = u.angle;
    ctx.save(); ctx.translate(u.x + lift * 0.7, u.y + lift + 8); ctx.rotate(a); ctx.filter = 'blur(4px)'; ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-L / 2, -W * 0.32, L, W * 0.64, 8) : ctx.rect(-L / 2, -W * 0.32, L, W * 0.64); ctx.fill(); ctx.filter = 'none'; ctx.restore();
    ctx.save(); ctx.translate(u.x, u.y + bob); ctx.rotate(a);
    // rear thruster plumes
    for (const y of [-W * 0.18, 0, W * 0.18]) { const g = ctx.createLinearGradient(-L / 2, 0, -L / 2 - 22, 0); g.addColorStop(0, 'rgba(160,220,255,0.9)'); g.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L / 2 + 2, y - 3); ctx.lineTo(-L / 2 - 16 - 5 * Math.sin(t * 20 + y), y); ctx.lineTo(-L / 2 + 2, y + 3); ctx.fill(); }
    ctx.drawImage(spr.img, -L / 2, -W / 2, L, W);
    // side pod thrusters glow (pods in the art sit at ~30% and ~53% of length)
    ctx.save(); ctx.shadowColor = '#4cb4ff'; ctx.shadowBlur = 10; for (const fx of [-0.2, 0.03]) for (const sy of [-1, 1]) { ctx.fillStyle = `rgba(150,215,255,${0.7 + 0.3 * Math.sin(t * 9 + fx * 10 + sy)})`;
      ctx.beginPath(); ctx.ellipse(fx * L, sy * W * 0.47, 3.2, 1.8, 0, 0, 7); ctx.fill(); } ctx.restore();
    // island tower aft (starboard): stacked superstructure with mast
    const tx = -L * 0.3, ty = -W * 0.2; ctx.fillStyle = '#2b3138'; ctx.fillRect(tx - 7, ty - 4, 14, 8); ctx.fillStyle = '#3d4650'; ctx.fillRect(tx - 5, ty - 3, 10, 5);
    ctx.fillStyle = '#566270'; ctx.fillRect(tx - 3, ty - 2, 6, 3); ctx.strokeStyle = '#1a1e22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 6, ty - 1); ctx.stroke();
    ctx.fillStyle = (t * 2 % 1) < 0.5 ? '#ff5040' : '#511'; ctx.fillRect(tx + 5.5, ty - 2, 1.6, 1.6); ctx.fillStyle = col; ctx.fillRect(tx - 7, ty + 3, 14, 1.4);
    // deck launch strobe toward the bow when the wing is out
    if (u.wing?.length) { const k = (t * 1.5) % 1; ctx.fillStyle = `rgba(255,230,150,${1 - k})`; ctx.fillRect(-L * 0.1 + k * L * 0.5, -1, 4, 2); }
    ctx.restore();
    this.hpBar(u, u.x - L * 0.3, u.y + bob - W / 2 - 8, L * 0.6, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.ellipse(u.x, u.y, L * 0.58, L * 0.3, 0, 0, 7); ctx.stroke(); }
    if (u.beingRepaired > 0) drawRepairGlint(ctx, u.x, u.y - W / 2 - 14, t);
    return true;
  }
  // v9.2 Fighter Jet / Stealth Bomber: painted top-down craft, rotated to heading and banked through turns.
  drawStrikeCraft(u, sel, col, t) {
    const ctx = this.ctx, bomber = u.type === 'bomber', lift = bomber ? 22 : 16;
    let alpha = 1;
    if (bomber && u.stealthed) { const near = u.team !== ME && this.g.units.some(o => o.team === ME && !o.dead && Math.hypot(o.x - u.x, o.y - u.y) < 80);
      alpha = u.team === ME ? 0.45 + 0.1 * Math.sin(t * 5) : near ? 0.5 : 0.1 + 0.06 * Math.sin(t * 7 + u.id); }
    ctx.save(); ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#000'; ctx.translate(u.x + lift * 0.6, u.y + lift); ctx.rotate(u.angle); ctx.scale(1, 1 - Math.abs(u.bank || 0) * 0.3);
    ctx.beginPath(); if (bomber) { ctx.moveTo(14, 0); ctx.lineTo(-10, 30); ctx.lineTo(-6, 0); ctx.lineTo(-10, -30); } else { ctx.moveTo(14, 0); ctx.lineTo(-10, 10); ctx.lineTo(-10, -10); } ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha; (bomber ? drawBomber : drawJet)(ctx, u, t, col); ctx.restore();
    if (u.team === ME || alpha > 0.3) this.hpBar(u, u.x - 12, u.y - (bomber ? 26 : 18), 24, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.arc(u.x, u.y, bomber ? 30 : 18, 0, 7); ctx.stroke(); }
    if (u.beingRepaired > 0) drawRepairGlint(ctx, u.x, u.y - 8, t);
  }
  // Rifle Trooper: ~24px human figure, feet on the ground point, walking bob/sway, muzzle flash, team ring + tint.
  drawSoldier(u, sel, col, t) {
    const ctx = this.ctx, H = 24, moving = Math.hypot(u.x - (u._lx ?? u.x), u.y - (u._ly ?? u.y)) > 0.05;
    u._lx = u.x; u._ly = u.y;
    const c = Math.cos(u.angle); if (Math.abs(c) > 0.2) u.faceRight = c > 0;
    const ph = t * 11 + u.id * 1.7, bob = moving ? Math.abs(Math.sin(ph)) * 1.6 : 0, sway = moving ? Math.sin(ph) * 0.07 : 0;
    const fx = u.x, fy = u.y + 5, dir = u.faceRight === false ? -1 : 1; // feet point
    ctx.strokeStyle = col; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fx, fy, 7.5, 3.2, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    ctx.fillStyle = '#000a'; ctx.beginPath(); ctx.ellipse(fx, fy, 5.5, 2.2, 0, 0, 7); ctx.fill();
    const spr = u.type === 'infantry' && getSprite('soldier', u.team);
    if (u.cloaked) ctx.globalAlpha = u.team === ME ? 0.35 + 0.1 * Math.sin(t * 8) : 0.08;
    if (u.stimT > 0) { ctx.save(); ctx.fillStyle = 'rgba(255,60,40,0.25)'; ctx.beginPath(); ctx.ellipse(fx, fy - 10, 7, 12, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(sway); ctx.translate(0, -bob); ctx.scale(dir, 1);
    if (spr) { const w = H / spr.aspect; ctx.drawImage(spr.img, -w / 2, -H, w, H); }
    else if (u.type !== 'infantry') drawTrooper(ctx, u, t, H, moving, ph);
    else { // fallback figure: legs (stepping), body, head, rifle
      const st = moving ? Math.sin(ph) * 3 : 0; ctx.strokeStyle = '#2a333c'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-2 + st, 0); ctx.moveTo(0, -9); ctx.lineTo(2 - st, 0); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(-3.5, -18, 7, 10); ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(0, -21, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#9ff'; ctx.fillRect(0.5, -22, 2.5, 1.2); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(9, -11); ctx.stroke(); ctx.lineCap = 'butt';
    }
    const w = u.stats.weapon; if (w && u.cool > w.cooldown - 0.08) { // just fired: muzzle flash at rifle tip
      ctx.save(); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff3c0'; const mz = spr ? [6.5, -7.5] : MUZZLE[u.type] || [10, -11]; ctx.beginPath(); ctx.arc(mz[0], mz[1], u.type === 'rocket' ? 3.5 : 2.4, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.restore(); ctx.lineWidth = 1; ctx.globalAlpha = 1;
    if (u.healing && !u.healing.dead) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 16)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy - 12); ctx.lineTo(u.healing.x, u.healing.y - 8); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#e33'; const hx = u.healing.x, hy = u.healing.y - 28 - (t * 20 % 8); ctx.fillRect(hx - 3, hy - 1, 6, 2); ctx.fillRect(hx - 1, hy - 3, 2, 6); }
    if (u.repairing && !u.repairing.dead) { ctx.strokeStyle = `rgba(120,255,140,${0.5 + 0.4 * Math.sin(t * 20)})`; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(fx, fy - 12); ctx.lineTo(u.repairing.x, u.repairing.y); ctx.stroke(); ctx.setLineDash([]); }
    if (u.team !== ME || sel || u.hp < u.stats.hp) this.hpBar(u, fx - 7, fy - H - 6 - bob, 14, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.ellipse(fx, fy, 9.5, 4.2, 0, 0, 7); ctx.stroke(); }
  }
  // Cosmetic tank variants (cycled by unit id). Isometric art: flip horizontally by heading instead of rotating.
  drawTankSprite(u, sel, col, r) {
    const spr = getSprite(u.type === 'harvester' ? 'harvester' : TANK_VARIANTS[u.id % 3], u.team); if (!spr) return false;
    const ctx = this.ctx, c = Math.cos(u.angle); if (Math.abs(c) > 0.2) u.faceRight = c > 0;
    // Grounded: sprite bottom (tracks/wheels) sits on the unit's ground point; tight contact shadow right under the hull.
    const w = u.type === 'harvester' ? 42 : 38, h = w * spr.aspect, gy = u.y + r * 0.5, sy = gy - h * 0.22;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(u.x, sy, w * 0.5, h * 0.34, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    ctx.fillStyle = '#000a'; ctx.beginPath(); ctx.ellipse(u.x, sy, w * 0.42, h * 0.24, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(u.x, gy); if (u.faceRight) ctx.scale(-1, 1);
    ctx.drawImage(spr.img, -w / 2, -h, w, h); ctx.restore();
    if (u.type === 'harvester') { const f = u.load / u.stats.capacity; ctx.fillStyle = '#000a'; ctx.fillRect(u.x - 12, gy + 2, 24, 3); // hopper fill
      ctx.fillStyle = '#4f8'; ctx.shadowColor = '#3f6'; ctx.shadowBlur = f > 0 ? 6 : 0; ctx.fillRect(u.x - 12, gy + 2, 24 * f, 3); ctx.shadowBlur = 0; }
    this.hpBar(u, u.x - r, gy - h - 3, r * 2, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.ellipse(u.x, sy, w * 0.56, h * 0.4, 0, 0, 7); ctx.stroke(); }
    return true;
  }
  // Air units: isometric art flipped by heading, hovering above a soft ground shadow.
  drawAirSprite(u, sel, col, r, t) {
    const name = u.type === 'carrier' ? 'carrier' : INTERCEPTOR_VARIANTS[u.id % INTERCEPTOR_VARIANTS.length];
    const spr = getSprite(name, u.team); if (!spr) return false;
    const ctx = this.ctx, c = Math.cos(u.angle); if (Math.abs(c) > 0.2) u.faceRight = c > 0;
    const big = u.type === 'carrier', w = big ? 72 : 22, h = w * spr.aspect, lift = big ? 16 : 10, bob = Math.sin(t * 2 + u.id) * (big ? 2 : 1.5);
    ctx.save(); ctx.filter = 'blur(3px)'; ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(u.x + lift * 0.6, u.y + lift + 6, w * 0.38, h * 0.22, 0, 0, 7); ctx.fill(); ctx.restore();
    if (big) { ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(u.x + 6, u.y + lift, w * 0.45, h * 0.3, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1; }
    ctx.save(); ctx.translate(u.x, u.y + bob); if (u.faceRight !== !!NATIVE_RIGHT[name]) ctx.scale(-1, 1);
    ctx.drawImage(spr.img, -w / 2, -h / 2, w, h); ctx.restore();
    if (!big) { ctx.fillStyle = col; ctx.fillRect(u.x - 1.5, u.y + bob - h / 2 - 3, 3, 3); return true; } // team marker
    this.hpBar(u, u.x - w * 0.35, u.y + bob - h / 2 - 6, w * 0.7, sel);
    if (sel) { ctx.strokeStyle = SEL; ctx.beginPath(); ctx.ellipse(u.x + 6, u.y + lift, w * 0.5, h * 0.36, 0, 0, 7); ctx.stroke(); }
    return true;
  }
  hpBar(e, x, y, w, always) { // v9: green-on-black bar like the painted preview
    if (!always && e.hp >= e.stats.hp) return;
    const f = e.hp / e.stats.hp, ctx = this.ctx;
    ctx.fillStyle = '#0b0d0be0'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = f > 0.5 ? '#3fd84a' : f > 0.25 ? '#d8c03f' : '#e0443a'; ctx.fillRect(x, y, w * f, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, w * f, 1);
  }
  drawFog(x0, y0, x1, y1) {
    const g = this.g; if (!g.fog.enabled) return; const ctx = this.ctx, v = g.fog.v;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const s = v[g.map.idx(x, y)]; if (s === 2) continue;
      ctx.fillStyle = s === 0 ? '#120d08' : '#120d0888'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  drawPlacement(ui) {
    const s = BUILDINGS[ui.placing], ht = ui.hoverTile, ok = this.g.canPlace(ME, ui.placing, ht.x, ht.y), ctx = this.ctx;
    ctx.globalAlpha = 0.55; (s.faction === 'reptile' ? drawOrganic : isAlienBuilding(s) ? drawAlienBuilding : drawBuildingArt)(ctx, { type: ui.placing, team: 0, faceRight: !!this.g.teams[ME].startLeft, tx: ht.x, ty: ht.y, w: s.w, h: s.h, stats: s, age: 9, aim: 1.57, charge: 0 }, performance.now() / 1000, null); ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? '#3f63' : '#f334'; ctx.strokeStyle = ok ? '#6f6' : '#f55';
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { ctx.fillRect((ht.x + x) * TILE + 1, (ht.y + y) * TILE + 1, TILE - 2, TILE - 2); }
    ctx.strokeRect(ht.x * TILE, ht.y * TILE, s.w * TILE, s.h * TILE);
  }
  // Full-footprint deploy preview: ghost of every carried building in its unfold slot, green/red per tile.
  drawDeploy(ui) {
    const mb = ui.deploying, p = ui.hoverWorld || { x: mb.x, y: mb.y }, ht = ui.deployTile(p), ctx = this.ctx, g = this.g;
    for (const f of mb.footprint()) {
      const s = BUILDINGS[f.type], tx = ht.x + f.dx, ty = ht.y + f.dy, ok = g.fits(ME, f.type, tx, ty);
      ctx.globalAlpha = 0.5; drawBuildingArt(ctx, { type: f.type, team: 0, faceRight: !!this.g.teams[ME].startLeft, tx, ty, w: s.w, h: s.h, stats: s, age: 9, aim: 1.57, charge: 0 }, performance.now() / 1000, null); ctx.globalAlpha = 1;
      ctx.fillStyle = ok ? '#3f63' : '#f334'; ctx.strokeStyle = ok ? '#6f6' : '#f55';
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) ctx.fillRect((tx + x) * TILE + 1, (ty + y) * TILE + 1, TILE - 2, TILE - 2);
      ctx.strokeRect(tx * TILE, ty * TILE, s.w * TILE, s.h * TILE);
    }
    ctx.strokeStyle = '#6f6'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(mb.x, mb.y); ctx.lineTo((ht.x + 1.5) * TILE, (ht.y + 1.5) * TILE); ctx.stroke(); ctx.setLineDash([]);
  }
  drawWallLine(ui) { const ctx = this.ctx, d = ui.wallDrag;
    for (const [x, y] of this.g.wallLine(d.x0, d.y0, d.x1, d.y1)) { const ok = this.g.canPlaceInstant(ME, ui.placing, x, y) || this.g.canPlace(ME, ui.placing, x, y);
      ctx.fillStyle = ok ? '#3f63' : '#f334'; ctx.strokeStyle = ok ? '#6f6' : '#f55'; ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2); ctx.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2); } }
  drawBurrow(ui) {
    const mb = ui.burrowing, p = ui.hoverWorld; if (!p) return; const ctx = this.ctx, r = 2.6 * TILE, t = performance.now() / 1000;
    ctx.strokeStyle = '#d9a35a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.moveTo(mb.x, mb.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = '#d9a35a33'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 7); ctx.fill();
  }
  drawTargeting(ui) {
    const ctx = this.ctx, p = ui.hoverWorld; if (!p) return; const r = 3 * TILE, t = performance.now() / 1000;
    ctx.strokeStyle = '#9cf'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = t * 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(p.x - 10, p.y); ctx.lineTo(p.x + 10, p.y); ctx.moveTo(p.x, p.y - 10); ctx.lineTo(p.x, p.y + 10); ctx.stroke(); ctx.lineWidth = 1;
  }
}
