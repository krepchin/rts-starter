// v10.3 "look B": dark sci-fi night. Cheap full-screen multiply tints + additive cached glow sprites (no per-pixel work, phone-safe).
import { TILE } from '../data/stats.js?v=10.0';
import { ME } from './local.js?v=10.0';
const cache = new Map();
function glowSprite(col) { let c = cache.get(col); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(0.35, col.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.45) + ')')); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); cache.set(col, c); return c; }
export const FACTION_LIGHT = { human: 'rgba(255,150,60,0.9)', reptile: 'rgba(120,255,60,0.9)', nordic: 'rgba(255,240,190,0.95)', grey: 'rgba(175,90,255,0.9)' };
export function light(ctx, x, y, r, col, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); }
export const night = { on: false }; // v10.0 look A (daylight): night pass disabled; kept for a possible night map
// after terrain + crystals + decals: deep blue night on the ground
export function nightGround(ctx, cam, g, x0, y0, x1, y1, t) {
  if (!night.on) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(44,58,104)'; ctx.fillRect(cam.x - 40, cam.y - 40, cam.vw + 80, cam.vh + 80);
  ctx.globalCompositeOperation = 'lighter';
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const a = g.map.tib[g.map.idx(x, y)]; if (a > 5) light(ctx, x * TILE + 16, y * TILE + 12, 26 + Math.min(18, a / 30), 'rgba(90,255,80,0.55)', 0.55 + 0.12 * Math.sin(t * 2 + x * 1.3 + y)); }
  ctx.restore(); }
// after all units: cool moonlight tint so sprites sit in the night, then emissive faction lights + mist
export function nightLights(ctx, cam, g, vis, units, t, fog) {
  if (!night.on) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(150,162,210)'; ctx.fillRect(cam.x - 40, cam.y - 40, cam.vw + 80, cam.vh + 80);
  ctx.globalCompositeOperation = 'lighter'; const fac = tm => g.teams[tm]?.faction || 'human';
  for (const b of vis) { if (b.dead) continue; const cx = (b.tx + b.w / 2) * TILE, cy = (b.ty + b.h / 2) * TILE, R = Math.max(b.w, b.h) * TILE, col = b.stats.wall || b.stats.gate ? 'rgba(255,150,60,0.5)' : FACTION_LIGHT[fac(b.team)];
    light(ctx, cx, cy, R * 0.95, col, (b.stats.wall || b.stats.gate ? 0.18 : 0.42) * (0.85 + 0.15 * Math.sin(t * 2.2 + b.id)));
    if (!b.stats.wall && !b.stats.gate) light(ctx, cx, cy - R * 0.25, R * 0.35, col, 0.5); }
  for (const u of units) { if (u.dead || (u.cloaked && !u.detected && u.team !== ME)) continue; const f = fac(u.team), air = u.isAir;
    let col = FACTION_LIGHT[f], r = Math.min(60, Math.max(16, (u.radius || 6) * 3)), a = 0.45;
    if (u.type === 'orbling' || u.type === 'probe') { col = 'rgba(220,235,255,0.95)'; r = 22; a = 0.8; }
    else if (f === 'grey' && air) { light(ctx, u.x, u.y + 2, r * 0.8, 'rgba(120,255,110,0.8)', 0.25); a = 0.3; }
    else if (f === 'human' && !u.stats.inf) { // headlights / floodlight cone ahead
      const ax = Math.cos(u.angle || 0), ay = Math.sin(u.angle || 0); light(ctx, u.x + ax * 22, u.y + ay * 14, 22, 'rgba(255,190,110,0.8)', 0.38); }
    light(ctx, u.x, u.y - (air ? 26 : 6), r, col, a);
    if (u.fired > 0) light(ctx, u.x + Math.cos(u.angle || 0) * 10, u.y - 8, 26, f === 'human' ? 'rgba(255,170,70,1)' : col, 0.9); }
  for (const e of g.effects) { if (e.boom) light(ctx, e.x, e.y, e.r * 2.6, 'rgba(255,150,60,1)', Math.min(1, e.t * 2)); else if (e.flash) light(ctx, e.x, e.y, e.r * 3, 'rgba(255,240,200,1)', 0.8);
    else if (e.x1 !== undefined && e.x2 !== undefined) light(ctx, e.x2, e.y2, 16, e.color?.startsWith('#') ? 'rgba(255,190,110,0.9)' : 'rgba(255,190,110,0.9)', 0.5); }
  for (const r of g.rockets) light(ctx, r.x, r.y, 20, 'rgba(255,170,80,1)', 0.8);
  // drifting ground mist
  ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 7; i++) { const mx = cam.x + ((i * 397 + t * (6 + i)) % (cam.vw + 400)) - 200, my = cam.y + ((i * 263) % cam.vh);
    light(ctx, mx, my, 220, 'rgba(70,90,140,0.5)', 0.22); }
  ctx.restore(); ctx.globalAlpha = 1; }
