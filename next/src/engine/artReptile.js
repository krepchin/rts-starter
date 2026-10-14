import { ME } from './local.js?v=10.1n';
// v10 art: Reptilian units (sprites cut from Kent's concept art, assets/r_*.png, with code fallbacks), drones, Brood Ship, eggs,
// organic structures (painted code art), the human Dune Buggy and Monster Truck, and new weapon effects.
import { TILE, UNITS, BUILDINGS } from '../data/stats.js?v=10.1n';
import { getSprite } from './sprites.js?v=10.1n';

const SPR = { raider: ['r_raider', 30], spitter: ['r_spitter', 28], brute: ['r_brute', 44], shaman: ['r_shaman', 38], hatchling: ['r_raider', 19],
  spark: ['r_spark', 20], lance: ['r_lance', 30], hiveorb: ['r_hive', 54], biotank: ['rb_tank', 30],
  // v10.1 Nordics + Greys (cut from Kent's faction concept sheets)
  sentinel: ['n_sentinel', 30], seer: ['n_seer', 32], guardian: ['n_guardian', 32], tallwhite: ['n_tallwhite', 46], skiff: ['n_skiff', 26], harmonizer: ['n_skiff', 20],
  lightcraft: ['n_lightcraft', 10], lightship: ['n_lightship', 30],
  greydrone: ['g_drone', 20], psionic: ['g_psionic', 24], abductor: ['g_abductor', 26], hybrid: ['g_hybrid', 28], crawler: ['g_crawler', 15],
  reaper: ['g_saucer', 14], };
const HOVER_GLOW = { nordic: 'rgba(255,245,200,0.5)', grey: 'rgba(190,120,255,0.45)' };
export const isFactionArt = type => !!SPR[type] || ['egg', 'broodship', 'grazer', 'buggy', 'truck', 'bike', 'probe', 'orbling', 'minisaucer', 'scoutsaucer', 'warsaucer', 'saucer', 'mothership'].includes(type);
const TEAMC = { 0: '#3fa9ff', 1: '#ff4a3a' };
function shadow(ctx, x, y, rx, ry, a = 0.3) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }
// v10.1 air depth: sun from upper-left, so a craft's ground shadow slides down-right and softens/shrinks with altitude
function airShadow(ctx, x, gy, rx, ry, alt) { const k = Math.min(1, alt / 60), ox = alt * 0.55, oy = alt * 0.22; ctx.fillStyle = `rgba(0,0,0,${0.12 - k * 0.04})`; ctx.beginPath(); ctx.ellipse(x + ox, gy + oy, rx * (1.15 - k * 0.15), ry * (1.25 - k * 0.15), 0, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(0,0,0,${0.24 - k * 0.08})`; ctx.beginPath(); ctx.ellipse(x + ox, gy + oy, rx * (0.85 - k * 0.15), ry * (0.85 - k * 0.15), 0, 0, 7); ctx.fill(); }
function glow(ctx, x, y, r, c, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(120,255,80,0)'); ctx.globalAlpha *= a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha /= a; }

// returns the top y of the drawn unit (for hp bars)
export function drawFactionUnit(ctx, u, t, viewer = 0) {
  const tp = u.type, face = Math.cos(u.angle || 0) >= 0 ? 1 : -1, moving = (u.order && u.order.type !== 'cast') || u.leap;
  const hidden = u.cloaked && u.team !== viewer && !u.detected; if (hidden) return null;
  if (u.life !== undefined && u.lifeMax) ctx.globalAlpha = Math.min(1, 0.35 + u.life / 8);
  let top = u.y - 30;
  if (SPR[tp]) {
    const [name, H] = SPR[tp], hover = UNITS[tp].hover || UNITS[tp].air, sp = getSprite(name, 0);
    let alt = hover ? 12 + Math.sin(t * 3 + (u.id || 0)) * 2.5 : (u.hop || 0), rep = UNITS[tp].faction === 'reptile' && !hover, gp = t * (tp === 'biotank' || tp === 'brute' ? 3.2 : 5) + (u.id || 0), bob = !hover && moving ? Math.abs(Math.sin(gp)) * (rep ? 1.1 : 1.6) : 0;
    if (hover) airShadow(ctx, u.x, u.y + 1, H * 0.42, H * 0.13, 12 + (UNITS[tp].air ? 16 : 0) + alt * 0.2); else shadow(ctx, u.x, u.y + 1, H * 0.35, H * 0.12, 0.3);
    if (u.team !== viewer || true) { ctx.strokeStyle = TEAMC[u.team]; ctx.globalAlpha *= 0.45; ctx.beginPath(); ctx.ellipse(u.x, u.y + 1, H * 0.33, H * 0.11, 0, 0, 7); ctx.stroke(); ctx.globalAlpha /= 0.45; }
    if (UNITS[tp].air) { alt += 16; }
    if (hover) glow(ctx, u.x, u.y - alt - H * 0.4, H * 0.75, HOVER_GLOW[UNITS[tp].faction] || 'rgba(170,255,90,0.45)', 0.7 + 0.3 * Math.sin(t * 5 + (u.id || 0)));
    if (u.shieldT > 0) { ctx.strokeStyle = `rgba(255,230,140,${0.5 + 0.3 * Math.sin(t * 10)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(u.x, u.y - alt - H * 0.5, H * 0.45, H * 0.6, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    if (u.stunT > 0) { ctx.fillStyle = '#d9a6ff'; for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; ctx.beginPath(); ctx.arc(u.x + Math.cos(a) * 7, u.y - alt - H - 4 + Math.sin(a) * 2, 1.6, 0, 7); ctx.fill(); } }
    if (u.beam && !u.beam.dead) { const b = u.beam, gr = ctx.createLinearGradient(u.x, u.y - alt, b.x, b.y); gr.addColorStop(0, 'rgba(160,255,120,0.7)'); gr.addColorStop(1, 'rgba(160,255,120,0.15)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(u.x - 5, u.y - alt - H * 0.2); ctx.lineTo(u.x + 5, u.y - alt - H * 0.2); ctx.lineTo(b.x + 14, b.y + 4); ctx.lineTo(b.x - 14, b.y + 4); ctx.closePath(); ctx.fill(); }
    if (u.lift > 0) { alt += u.lift * 26; }
    if (u.hardT > 0) glow(ctx, u.x, u.y - H * 0.5, H * 0.7, 'rgba(200,255,120,0.5)');
    const y0 = u.y - alt - bob; ctx.save(); ctx.translate(u.x, y0);
    if (u.fired > 0 && !hover) ctx.translate(face * 2, 0);
    if (hover) { const pa = u._pa ?? u.angle ?? 0, da = Math.atan2(Math.sin((u.angle || 0) - pa), Math.cos((u.angle || 0) - pa)); u._pa = u.angle; u._bank = (u._bank || 0) * 0.88 + Math.max(-0.3, Math.min(0.3, da * 4)) * 0.12;
      ctx.rotate(u._bank + Math.sin(t * 2.1 + (u.id || 0)) * 0.05); const br = 1 + Math.sin(t * 3.2 + (u.id || 0)) * 0.035; ctx.scale(1 / br, br); } // bank into turns, sway, breathe
    if (rep) ctx.rotate(moving ? Math.sin(gp) * (tp === 'biotank' ? 0.035 : 0.07) : Math.sin(t * 1.3 + (u.id || 0)) * 0.015); // reptile stride: weight shifts side to side, idle breathing sway
    ctx.scale(face * (tp === 'spark' ? -1 : 1), 1);
    if (sp) { const w = H / sp.aspect; ctx.drawImage(sp.img, -w / 2, -H, w, H);
      if (UNITS[tp].faction === 'reptile') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -H * 0.45, H * 0.32, 'rgba(120,255,60,0.6)', 0.35 + 0.35 * Math.sin(t * 4 + (u.id || 0))); ctx.globalCompositeOperation = 'source-over'; } }
    else { ctx.fillStyle = hover ? '#7a8a3a' : '#4a5a32'; ctx.beginPath(); ctx.ellipse(0, -H / 2, H * 0.3, H / 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#9f4'; ctx.beginPath(); ctx.arc(H * 0.12, -H * 0.7, 2.5, 0, 7); ctx.fill(); }
    ctx.restore(); top = y0 - H;
    if (u.cloaked) { ctx.strokeStyle = 'rgba(160,255,220,0.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.ellipse(u.x, y0 - H / 2, H * 0.4, H * 0.55, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  } else if (tp === 'egg') {
    const k = Math.min(1, u.inc / u.stats.hatchTime), p = 0.5 + 0.5 * Math.sin(t * (4 + k * 10));
    shadow(ctx, u.x, u.y + 2, 10, 4); glow(ctx, u.x, u.y - 8, 16 + k * 6, `rgba(160,255,80,${0.3 + p * 0.4})`);
    const g = ctx.createRadialGradient(u.x - 3, u.y - 12, 1, u.x, u.y - 8, 12); g.addColorStop(0, '#d6e89a'); g.addColorStop(0.5, '#7d8f3e'); g.addColorStop(1, '#3b4520');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(u.x, u.y - 8, 7.5, 10, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a3018'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = `rgba(200,255,120,${0.3 + p * 0.5})`; ctx.beginPath(); ctx.ellipse(u.x, u.y - 9, 3, 5, 0, 0, 7); ctx.fill();
    if (k > 0.4) { ctx.strokeStyle = '#1b1f10'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(u.x - 2, u.y - 17); ctx.lineTo(u.x + 1, u.y - 13); ctx.lineTo(u.x - 1, u.y - 10);
      if (k > 0.7) { ctx.moveTo(u.x + 4, u.y - 14); ctx.lineTo(u.x + 2, u.y - 9); ctx.lineTo(u.x + 5, u.y - 6); } ctx.stroke(); }
    ctx.fillStyle = '#0008'; ctx.fillRect(u.x - 9, u.y + 4, 18, 3); ctx.fillStyle = '#c8ff7a'; ctx.fillRect(u.x - 9, u.y + 4, 18 * k, 3); top = u.y - 20;
  } else if (tp === 'broodship') { top = drawBroodShip(ctx, u, t, face); }
  else if (tp === 'grazer') { top = drawGrazer(ctx, u, t, face, moving); }
  else if (tp === 'probe' || tp === 'orbling') { top = drawOrb(ctx, u, t); }
  else if (SAUCER[tp]) { top = drawSaucer(ctx, u, t, SAUCER[tp]); }
  else if (tp === 'buggy' || tp === 'truck' || tp === 'bike') { top = drawCar(ctx, u, t, face, moving); }
  if (u.life !== undefined && u.lifeMax) { const f = Math.max(0, u.life / u.lifeMax); ctx.globalAlpha = 1; ctx.fillStyle = '#0009'; ctx.fillRect(u.x - 8, top - 4, 16, 2); ctx.fillStyle = '#ffd24a'; ctx.fillRect(u.x - 8, top - 4, 16 * f, 2); }
  ctx.globalAlpha = 1;
  if (u.healing && !u.healing.dead) { ctx.strokeStyle = `rgba(120,255,160,${0.4 + 0.3 * Math.sin(t * 14)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(u.x, u.y - 30); ctx.quadraticCurveTo((u.x + u.healing.x) / 2, Math.min(u.y, u.healing.y) - 40, u.healing.x, u.healing.y - 10); ctx.stroke(); ctx.lineWidth = 1; }
  return top;
}
function drawBroodShip(ctx, u, t, face) {
  // v10.1: sprite cut pixel-faithful from Kent's Brood Ship sketch; motion only (hover heave, banking, egg-sac pulse, wing-beat lift)
  const sp = getSprite('rb_brood', 0), id = u.id || 0, beat = Math.sin(t * 2.2 + id), lift = 36 + Math.sin(t * 1.1 + id) * 2.5 + beat * 1.2, x = u.x, y = u.y - lift, W = 150;
  airShadow(ctx, u.x, u.y + 4, 56, 13, lift);
  const pa = u._pa ?? u.angle ?? 0, da = Math.atan2(Math.sin((u.angle || 0) - pa), Math.cos((u.angle || 0) - pa)); u._pa = u.angle; u._bank = (u._bank || 0) * 0.92 + Math.max(-0.12, Math.min(0.12, da * 3)) * 0.08;
  ctx.save(); ctx.translate(x, y); ctx.rotate(u._bank + Math.sin(t * 0.8 + id) * 0.025); ctx.scale(face, 1);
  if (sp) { const H = W * sp.aspect; ctx.drawImage(sp.img, -W / 2, -H * 0.62, W, H);
    const p = 0.5 + 0.5 * Math.sin(t * 2.6 + id); ctx.globalCompositeOperation = 'lighter'; // egg sacs under the belly breathe with light
    for (let i = 0; i < 6; i++) glow(ctx, -W * 0.13 + i * W * 0.045, -H * 0.62 + H * (0.7 - Math.abs(i - 2.5) * 0.02), 9, `rgba(150,255,70,${0.18 + 0.22 * Math.sin(t * 2.6 + id + i * 0.7) ** 2})`);
    glow(ctx, W * 0.3, -H * 0.3, 6, `rgba(210,255,120,${0.35 + p * 0.3})`); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore(); ctx.strokeStyle = TEAMC[u.team]; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 52, 12, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  return y - 34;
}
function drawGrazer(ctx, u, t, face, moving) {
  // v10.1: the small Bio-Tank from Kent's sketch as the gatherer: heavy tortoise-lizard plodding gait, glowing load
  const sp = getSprite('rb_grazer', 0), W = 50, gp = t * 3.4 + (u.id || 0); shadow(ctx, u.x, u.y + 2, 20, 6);
  ctx.save(); ctx.translate(u.x, u.y + 1 - (moving ? Math.abs(Math.sin(gp)) * 0.9 : 0)); ctx.rotate(moving ? Math.sin(gp) * 0.03 : 0); ctx.scale(face, 1);
  if (sp) { const H = W * sp.aspect; ctx.drawImage(sp.img, -W / 2, -H, W, H); }
  const f = Math.min(1, (u.load || 0) / u.stats.capacity); ctx.globalCompositeOperation = 'lighter'; glow(ctx, -2, -9, 9, `rgba(150,255,80,${0.1 + f * 0.5})`); ctx.globalCompositeOperation = 'source-over';
  ctx.restore(); ctx.strokeStyle = TEAMC[u.team]; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 18, 6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; return u.y - 22;
}
function wheel(ctx, x, y, r, spin) { ctx.fillStyle = '#1d1c19'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#3c3a34'; ctx.lineWidth = r * 0.28; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, 7); ctx.stroke();
  ctx.lineWidth = 1; ctx.fillStyle = '#6a685f'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill(); ctx.strokeStyle = '#121110'; for (let i = 0; i < 6; i++) { const a = spin + i; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } }
function drawCar(ctx, u, t, face, moving) {
  if (u.type === 'bike') return drawBike(ctx, u, t, face, moving);
  const truck = u.type === 'truck', bounce = moving ? Math.abs(Math.sin(t * (truck ? 10 : 16) + (u.id || 0))) * (truck ? 1.8 : 1.2) : 0, spin = moving ? t * 14 : 0;
  shadow(ctx, u.x, u.y + 2, truck ? 22 : 15, truck ? 7 : 5);
  ctx.save(); ctx.translate(u.x, u.y); ctx.scale(face, 1);
  if (truck) {
    if (u.ramT > 0) { ctx.fillStyle = 'rgba(200,170,120,0.35)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-22 - i * 8, -4 + Math.random() * 3, 5 + i * 2, 0, 7); ctx.fill(); } }
    wheel(ctx, -13, -8, 9, spin); wheel(ctx, 13, -8, 9, spin);
    ctx.fillStyle = '#5e6248'; ctx.fillRect(-14, -20 - bounce, 4, 8); ctx.fillRect(10, -20 - bounce, 4, 8);
    const g = ctx.createLinearGradient(0, -34, 0, -16); g.addColorStop(0, '#9a8a52'); g.addColorStop(1, '#4b4428'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-20, -18 - bounce); ctx.lineTo(-20, -27 - bounce); ctx.lineTo(-6, -27 - bounce); ctx.lineTo(-1, -34 - bounce); ctx.lineTo(11, -34 - bounce); ctx.lineTo(15, -27 - bounce); ctx.lineTo(21, -25 - bounce); ctx.lineTo(21, -18 - bounce); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#211e12'; ctx.stroke(); ctx.fillStyle = '#9fc4c0'; ctx.fillRect(1, -32 - bounce, 9, 5);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-20, -21 - bounce, 41, 2); ctx.fillStyle = '#2b2a24'; ctx.fillRect(20, -23 - bounce, 4, 5); // ram bar
    ctx.fillStyle = '#303128'; ctx.fillRect(16, -30 - bounce, 8, 2); ctx.fillRect(16, -27 - bounce, 8, 2); // front MGs
    ctx.fillStyle = '#4a4c42'; ctx.fillRect(-19, -33 - bounce, 11, 6); ctx.fillStyle = '#1a1a16'; for (let i = 0; i < 3; i++) ctx.fillRect(-19, -32 - bounce + i * 2, 2, 1.4); // rear rocket pod
    if (u.fired > 0) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(26, -28 - bounce, 2.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = u.team === ME ? '#4fa7d8' : '#c8402c'; ctx.fillRect(-4, -24 - bounce, 6, 3);
  } else {
    wheel(ctx, -9, -5, 6, spin); wheel(ctx, 10, -4, 4.5, spin);
    ctx.fillStyle = '#7d7046'; ctx.beginPath(); ctx.moveTo(-14, -8 - bounce); ctx.lineTo(15, -7 - bounce); ctx.lineTo(13, -12 - bounce); ctx.lineTo(-12, -13 - bounce); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2b2a24'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-8, -12 - bounce); ctx.lineTo(-5, -22 - bounce); ctx.lineTo(5, -22 - bounce); ctx.lineTo(8, -12 - bounce); ctx.moveTo(-5, -22 - bounce); ctx.lineTo(-10, -12 - bounce); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#303128'; ctx.fillRect(2, -25 - bounce, 9, 2); ctx.fillStyle = '#c9a227'; ctx.fillRect(-14, -9 - bounce, 6, 2);
    if (u.fired > 0) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(12, -24 - bounce, 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = u.team === ME ? '#4fa7d8' : '#c8402c'; ctx.fillRect(-3, -11 - bounce, 4, 2);
  }
  ctx.restore(); return u.y - (truck ? 38 : 26);
}

// ---- organic reptilian structures (painted code art)
export function drawOrganic(ctx, b, t) {
  const X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE, cx = X + W / 2, cy = Y + H / 2, p = 0.5 + 0.5 * Math.sin(t * 2.4 + (b.id || 0)), dmg = 1 - b.hp / b.stats.hp;
  const RISE = 2.6, age = b.age ?? 9, creep = Math.min(1, age / 0.6), built = Math.max(0, Math.min(1, (age - 0.4) / (RISE - 0.4)));
  // creep / ooze patch spreads first
  if (creep > 0) { const g = ctx.createRadialGradient(cx, Y + H - 6, 2, cx, Y + H - 6, W * 0.75 * creep); g.addColorStop(0, 'rgba(40,60,20,0.75)'); g.addColorStop(0.7, 'rgba(30,45,18,0.45)'); g.addColorStop(1, 'rgba(20,30,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, Y + H - 6, W * 0.75 * creep, H * 0.42 * creep, 0, 0, 7); ctx.fill();
    if (built < 1) { ctx.strokeStyle = 'rgba(140,255,80,0.35)'; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = i * 0.9 + (b.id || 0); ctx.beginPath(); ctx.moveTo(cx, Y + H - 6);
      ctx.quadraticCurveTo(cx + Math.cos(a) * W * 0.3, Y + H - 6 + Math.sin(a) * H * 0.1, cx + Math.cos(a) * W * 0.7 * creep, Y + H - 6 + Math.sin(a) * H * 0.38 * creep); ctx.stroke(); } } }
  if (built <= 0) return;
  shadow(ctx, cx + 4, Y + H - 4, W * 0.5 * built, H * 0.24, 0.3);
  const top = Y - H * 0.35, revealY = Y + H + 2 - (Y + H + 2 - top) * built; // reveal line moves bottom -> top
  ctx.save(); if (built < 1) { ctx.beginPath(); ctx.rect(X - W, revealY, W * 3, Y + H * 2 - revealY); ctx.clip(); }
  const mound = (rx, ry, oy = 0) => { const g = ctx.createRadialGradient(cx - rx * 0.3, Y + H - ry - oy - ry * 0.4, 2, cx, Y + H - ry * 0.6 - oy, rx * 1.1);
    g.addColorStop(0, '#c9b67a'); g.addColorStop(0.45, '#878447'); g.addColorStop(1, '#4a4322'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, Y + H - ry * 0.55 - oy, rx, ry, 0, Math.PI, 0); ctx.quadraticCurveTo(cx + rx * 0.9, Y + H - oy + 2, cx, Y + H - oy + 2); ctx.quadraticCurveTo(cx - rx * 0.9, Y + H - oy + 2, cx - rx, Y + H - ry * 0.55 - oy); ctx.fill();
    ctx.strokeStyle = 'rgba(25,22,10,0.6)'; ctx.lineWidth = 1; const my = Y + H - ry * 0.55 - oy; for (let r = 0; r < 4; r++) { const rr = 0.92 - r * 0.22, n = Math.max(3, Math.round(rx * rr / 5)); // rows of overlapping scutes (scaled hide)
      for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5 + (r % 2) * 0.5) / (n + 0.5) * Math.PI, sx = cx + Math.cos(a) * rx * rr, sy = my + Math.sin(a) * ry * rr * 0.95 + 2, sw = 3.4 + rr * 2;
        ctx.fillStyle = r % 2 ? 'rgba(150,135,80,0.35)' : 'rgba(40,44,20,0.25)'; ctx.beginPath(); ctx.moveTo(sx - sw, sy); ctx.quadraticCurveTo(sx, sy - sw * 1.3, sx + sw, sy); ctx.quadraticCurveTo(sx, sy + sw * 0.5, sx - sw, sy); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = '#d9cb9c'; for (let i = -2; i <= 2; i++) { const sx = cx + i * rx * 0.22, sy = my - ry * 0.93 * Math.sqrt(1 - (i * 0.22) ** 2); ctx.beginPath(); ctx.moveTo(sx - 3, sy + 1); ctx.lineTo(sx + 1, sy - 5); ctx.lineTo(sx + 3, sy + 1); ctx.fill(); } }; // dorsal bone ridge
  const sac = (x, y, r) => { glow(ctx, x, y, r * 2.4, `rgba(150,255,80,${0.3 + p * 0.35})`); ctx.fillStyle = `rgba(165,240,85,${0.7 + p * 0.25})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#33441a'; ctx.stroke(); };
  const spike = (x, y, h, a = 0) => { ctx.fillStyle = '#e0d3a8'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x + a * 0.5, y - h * 0.6, x + a, y - h); ctx.quadraticCurveTo(x + 1, y - h * 0.5, x + 3, y); ctx.fill(); ctx.strokeStyle = '#7a6a44'; ctx.stroke(); ctx.strokeStyle = 'rgba(120,100,60,0.6)'; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 2.5 + a * k * 0.15, y - h * k * 0.22); ctx.lineTo(x + 2.5 + a * k * 0.15, y - h * k * 0.22); ctx.stroke(); } };
  switch (b.type) {
    case 'hive': mound(W * 0.48, H * 0.62); for (const [dx, h, a] of [[-30, 22, -8], [-14, 30, -4], [6, 34, 3], [24, 24, 8]]) spike(cx + dx, Y + H * 0.42, h, a);
      ctx.fillStyle = '#d9cb9c'; ctx.beginPath(); ctx.ellipse(cx, Y + H - 17, 18, 13, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1e160a'; ctx.beginPath(); ctx.ellipse(cx, Y + H - 16, 13, 9, 0, 0, 7); ctx.fill(); sac(cx, Y + H - 16, 7); sac(cx - 26, Y + H - 24, 5); sac(cx + 28, Y + H - 22, 5); break;
    case 'heart': mound(W * 0.42, H * 0.4); { const s = 1 + p * 0.1; ctx.save(); ctx.translate(cx, Y + H * 0.48); ctx.scale(s, s); sac(0, 0, 13); ctx.restore(); }
      ctx.strokeStyle = '#d9cb9c'; ctx.lineWidth = 2.5; for (const a of [-2.4, -1.6, -0.8]) { ctx.beginPath(); ctx.moveTo(cx, Y + H * 0.5); ctx.quadraticCurveTo(cx + Math.cos(a) * 18, Y + H * 0.6, cx + Math.cos(a) * 26, Y + H - 6); ctx.stroke(); } ctx.lineWidth = 1; break;
    case 'digester': mound(W * 0.46, H * 0.55); sac(cx - 14, Y + H * 0.45, 11); sac(cx + 16, Y + H * 0.52, 8);
      ctx.strokeStyle = '#d6c798'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 30, Y + H - 6); ctx.quadraticCurveTo(cx + 44, Y + H * 0.4, cx + 30, Y + 8); ctx.stroke(); ctx.lineWidth = 1; break;
    case 'spawnpool': ctx.fillStyle = '#3a3218'; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.46, H * 0.32, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(120,220,60,${0.75 + p * 0.2})`; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.38, H * 0.24, 0, 0, 7); ctx.fill(); glow(ctx, cx, Y + H * 0.62, W * 0.45, 'rgba(160,255,90,0.35)');
      for (let i = 0; i < 3; i++) { const bx = cx + Math.sin(t * 1.3 + i * 2) * 14, by = Y + H * 0.62 + Math.cos(t * 1.7 + i) * 5; ctx.fillStyle = 'rgba(220,255,160,0.7)'; ctx.beginPath(); ctx.arc(bx, by, 2 + ((t * 2 + i) % 1) * 2, 0, 7); ctx.fill(); }
      for (const dx of [-24, -8, 8, 24]) { ctx.strokeStyle = '#d8c89a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + dx, Y + H * 0.85); ctx.quadraticCurveTo(cx + dx * 0.6, Y + H * 0.15, cx, Y + H * 0.22); ctx.stroke(); } ctx.lineWidth = 1; break;
    case 'dronenest': ctx.fillStyle = '#5b4a2a'; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.64, W * 0.47, H * 0.34, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2e18'; ctx.lineWidth = 2; // woven nest of reeds/hide
      for (let i = 0; i < 14; i++) { const a = i / 14 * 7; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.64, W * 0.47 - (i % 3) * 3, H * 0.34 - (i % 3) * 2, 0, a, a + 0.9); ctx.stroke(); } ctx.lineWidth = 1;
      for (const [ex, ey] of [[-20, 0.56], [0, 0.5], [20, 0.56], [-10, 0.7], [12, 0.7]]) { const x = cx + ex, y = Y + H * ey, g = ctx.createRadialGradient(x - 3, y - 7, 1, x, y - 4, 11);
        g.addColorStop(0, '#c9c08a'); g.addColorStop(0.55, '#6f7a3c'); g.addColorStop(1, '#2f3418'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 4, 8, 11, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a2a14'; ctx.stroke(); sac(x, y - 4, 2.5 + p); }
      for (const [dx, h, a] of [[-W * 0.44, 26, -6], [W * 0.44, 26, 6], [-W * 0.3, 18, -3], [W * 0.3, 18, 3]]) spike(cx + dx, Y + H * 0.68, h, a); break; // bone tusks around the nest
    case 'seer': mound(W * 0.36, H * 0.3); ctx.strokeStyle = '#7a6c3e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx, Y + H - 10); ctx.quadraticCurveTo(cx - 10 + Math.sin(t) * 3, Y + H * 0.3, cx + 4, Y - 6); ctx.stroke(); ctx.lineWidth = 1;
      { const ex = cx + 4 + Math.sin(t) * 1.5, ey = Y - 10; ctx.fillStyle = '#e8e0b0'; ctx.beginPath(); ctx.ellipse(ex, ey, 9, 7, 0, 0, 7); ctx.fill(); glow(ctx, ex, ey, 16, 'rgba(170,255,90,0.5)');
        ctx.fillStyle = '#4c9a1a'; ctx.beginPath(); ctx.arc(ex + Math.sin(t * 0.7) * 3, ey, 3.8, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(ex + Math.sin(t * 0.7) * 3 - 0.8, ey - 3, 1.6, 6); } break;
    case 'broodspire': mound(W * 0.46, H * 0.5); for (const [dx, h] of [[-18, 40], [0, 58], [18, 36]]) { ctx.fillStyle = '#d6c798'; ctx.beginPath(); ctx.moveTo(cx + dx - 8, Y + H * 0.6); ctx.quadraticCurveTo(cx + dx - 6, Y + H * 0.6 - h * 0.6, cx + dx + Math.sin(t + dx) * 2, Y + H * 0.6 - h); ctx.quadraticCurveTo(cx + dx + 4, Y + H * 0.6 - h * 0.5, cx + dx + 8, Y + H * 0.6); ctx.fill(); ctx.strokeStyle = '#2a2612'; ctx.stroke(); }
      ctx.fillStyle = 'rgba(140,120,70,0.55)'; ctx.beginPath(); ctx.moveTo(cx - 18, Y + H * 0.6 - 36); ctx.quadraticCurveTo(cx - 9, Y + H * 0.6 - 30, cx, Y + H * 0.6 - 54); ctx.quadraticCurveTo(cx + 9, Y + H * 0.6 - 30, cx + 18, Y + H * 0.6 - 32); ctx.lineTo(cx, Y + H * 0.6 - 10); ctx.closePath(); ctx.fill();
      sac(cx, Y + H * 0.6 - 20, 6); break;
    case 'spine': { const a = b.aim ?? 0; mound(13, 9); ctx.strokeStyle = '#6b5f36'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, Y + H - 8);
      const tx = cx + Math.cos(a) * 12, ty = Y + H * 0.2 + Math.sin(a) * 4; ctx.quadraticCurveTo(cx - Math.cos(a) * 6, Y + H * 0.35, tx, ty); ctx.stroke(); ctx.lineWidth = 1;
      sac(cx - 5, Y + H - 14, 5); ctx.fillStyle = '#d8c89a'; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, 7); ctx.fill(); if (b.flash > 0) glow(ctx, tx + Math.cos(a) * 4, ty, 10, 'rgba(180,255,90,0.9)'); break; }
    default: mound(W * 0.45, H * 0.5); sac(cx, Y + H * 0.5, 8);
  }
  if (dmg > 0.4) { ctx.fillStyle = 'rgba(60,20,10,0.5)'; ctx.beginPath(); ctx.ellipse(cx - W * 0.15, Y + H * 0.6, 8, 4, 0.4, 0, 7); ctx.fill(); }
  if (dmg > 0.7) { ctx.fillStyle = 'rgba(150,230,80,0.6)'; ctx.beginPath(); ctx.ellipse(cx + W * 0.2, Y + H * 0.7, 3, 6, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  if (built < 1) { // glowing growth edge with sinew tendrils knitting the shell
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const eg = ctx.createLinearGradient(0, revealY - 5, 0, revealY + 5); eg.addColorStop(0, 'rgba(120,255,60,0)'); eg.addColorStop(0.5, 'rgba(160,255,90,0.85)'); eg.addColorStop(1, 'rgba(120,255,60,0)');
    const half = W * 0.5 * Math.sqrt(Math.max(0.05, 1 - Math.pow((revealY - (Y + H * 0.55)) / (H * 1.3), 2)));
    ctx.fillStyle = eg; ctx.fillRect(cx - half, revealY - 5, half * 2, 10);
    ctx.strokeStyle = 'rgba(170,255,110,0.6)'; ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const x = cx - half + (i + 0.5) / 6 * half * 2, w = Math.sin(t * 6 + i * 2) * 4;
      ctx.beginPath(); ctx.moveTo(x, revealY + 8); ctx.quadraticCurveTo(x + w, revealY - 2, x + w * 0.5, revealY - 10 - (i % 3) * 3); ctx.stroke(); }
    ctx.restore(); }
  else if (age < RISE + 0.5) { const k = 1 - (age - RISE) / 0.5; glow(ctx, cx, Y + H * 0.45, W * 0.7, `rgba(170,255,90,${0.35 * k})`); } // completion pulse (soft, no size change)
  ctx.fillStyle = b.team === ME ? '#4fa7d8' : '#c8402c'; ctx.fillRect(X + 3, Y + H - 6, 5, 3);
}

// ---- weapon fx: acid globs, bio-cannon, lightning, beam, tiberium magic, claws
export function drawFx(ctx, e, t) {
  const fx = e.fx, k = Math.max(0, 1 - e.t / (fx === 'lightning' ? 0.18 : 0.25));
  if (fx === 'lightning') { ctx.strokeStyle = e.color || '#d8ff9a'; ctx.shadowColor = '#bfff6a'; ctx.shadowBlur = 8; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(e.x1, e.y1 - (e.hover ? 14 : 0));
    const n = 6; for (let i = 1; i <= n; i++) { const f = i / n; ctx.lineTo(e.x1 + (e.x2 - e.x1) * f + (i < n ? (Math.random() - .5) * 10 : 0), e.y1 - (e.hover ? 14 : 0) * (1 - f) + (e.y2 - e.y1) * f + (i < n ? (Math.random() - .5) * 10 : 0)); }
    ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1; return; }
  if (fx === 'beam') { const a = 1 - k * 0.7; ctx.strokeStyle = `rgba(200,255,120,${a})`; ctx.shadowColor = '#9f4'; ctx.shadowBlur = 12; ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.moveTo(e.x1, e.y1 - 14); ctx.lineTo(e.x2, e.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,230,${a})`; ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1; glow(ctx, e.x2, e.y2, 14, `rgba(200,255,120,${a})`); return; }
  if (fx === 'claw') { ctx.strokeStyle = `rgba(230,255,200,${1 - k})`; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(e.x2 - 6, e.y2 - 10 + i * 4); ctx.lineTo(e.x2 + 6, e.y2 - 4 + i * 4); ctx.stroke(); } ctx.lineWidth = 1; return; }
  // projectiles: acid (small arc), bio (big glob), magic (sparkly bolt)
  const kk = Math.min(1, k * 1.5), x = e.x1 + (e.x2 - e.x1) * kk, y = e.y1 - 10 + (e.y2 - e.y1 + 10) * kk - Math.sin(kk * Math.PI) * (fx === 'bio' ? 18 : fx === 'acid' ? 12 : 4), r = fx === 'bio' ? 5 : fx === 'magic' ? 3 : 2.6;
  if (kk < 1) { glow(ctx, x, y, r * 3, fx === 'magic' ? 'rgba(150,255,200,0.8)' : 'rgba(170,255,80,0.7)'); ctx.fillStyle = fx === 'magic' ? '#d8fff0' : '#c8ff6a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    if (fx === 'magic') for (let i = 0; i < 3; i++) { ctx.fillStyle = '#aff'; ctx.fillRect(x - (e.x2 - e.x1) * 0.05 * i + (Math.random() - .5) * 4, y + (Math.random() - .5) * 4, 1.5, 1.5); } }
  else { ctx.fillStyle = `rgba(150,240,70,${(1 - k) * 2})`; ctx.beginPath(); ctx.ellipse(e.x2, e.y2, r * 2.2, r * 1.1, 0, 0, 7); ctx.fill(); }
}
export function drawZone(ctx, z, t) {
  const a = Math.min(1, z.t / 0.8, (z.dur - z.t) / 0.3 + 0.2);
  if (z.kind === 'acid') { ctx.fillStyle = `rgba(120,210,40,${0.35 * a})`; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.5, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++) { const bx = z.x + Math.cos(i * 1.3 + t) * z.r * 0.6, by = z.y + Math.sin(i * 2.1 + t * 1.3) * z.r * 0.3; ctx.fillStyle = `rgba(210,255,140,${0.6 * a})`; ctx.beginPath(); ctx.arc(bx, by, 1.5 + ((t * 2 + i * 0.3) % 1) * 2, 0, 7); ctx.fill(); } }
  else { glow(ctx, z.x, z.y - 10, z.r * 1.4, `rgba(120,255,160,${0.35 * a})`); ctx.strokeStyle = `rgba(170,255,200,${0.7 * a})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const ang = t * 3 + i * 1.05, rr = z.r * (0.3 + (i % 3) * 0.25); ctx.beginPath(); ctx.arc(z.x, z.y - 8, rr, ang, ang + 1.2); ctx.stroke();
      ctx.fillStyle = `rgba(150,255,120,${0.8 * a})`; ctx.beginPath(); ctx.moveTo(z.x + Math.cos(ang) * rr, z.y - 8 + Math.sin(ang) * rr * 0.5 - 5); ctx.lineTo(z.x + Math.cos(ang) * rr + 2, z.y - 8 + Math.sin(ang) * rr * 0.5); ctx.lineTo(z.x + Math.cos(ang) * rr - 2, z.y - 8 + Math.sin(ang) * rr * 0.5); ctx.fill(); }
    if (Math.random() < 0.3) { ctx.strokeStyle = '#eaffd0'; ctx.beginPath(); const lx = z.x + (Math.random() - .5) * z.r * 1.4; ctx.moveTo(lx, z.y - 50); ctx.lineTo(lx + (Math.random() - .5) * 10, z.y - 25); ctx.lineTo(lx + (Math.random() - .5) * 8, z.y); ctx.stroke(); } ctx.lineWidth = 1; }
}

// v10.1 Nordic / Grey structures: concept-art cutout on a faction pad (white marble + gold glyph ring / dark alloy + psi lights).
const PADS = { nordic: { a: '#e8e2d0', b: '#b9ad8a', ring: '#e6c35a', glow: 'rgba(255,240,190,0.55)' }, grey: { a: '#3a3a40', b: '#1c1c22', ring: '#a46cff', glow: 'rgba(150,255,110,0.45)' } };
const ART_SCALE = { n_spire: 0.75, n_crystal: 0.8, g_orb: 0.8, g_hive: 1.05, g_dome: 1.15, n_skiff: 1.15, n_lightcraft: 1.2, g_saucer: 1.15 };
export function drawAlienBuilding(ctx, b, t) {
  // v10.1: every Nordic / Grey structure has its own procedural architecture (no shared or unit sprites):
  // Nordics = white marble + gold trim, stepped plinths, spires, arches and floating crystals; Greys = brushed silver domes & discs, purple light seams.
  const s = b.stats, X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE, cx = X + W / 2, gy = Y + H - 4, id = b.id || 0, p = 0.5 + 0.5 * Math.sin(t * 2 + id), off = b.powered === false;
  shadow(ctx, cx + 6, gy - 2, W * 0.5, H * 0.22, 0.32);
  if (s.faction === 'nordic') nordicBuilding(ctx, b.type, X, Y, W, H, cx, gy, t, p, off); else greyBuilding(ctx, b.type, X, Y, W, H, cx, gy, t, p, off);
  ctx.fillStyle = TEAMC[b.team] || '#fff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(X + 6, gy - 1, 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (s.weapon && b.flash > 0 && b.target) { ctx.strokeStyle = s.weapon.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, Y - 16); ctx.lineTo(b.target.x, b.target.y); ctx.stroke(); ctx.lineWidth = 1; }
}
const lg = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
// ---- Nordic: marble + gold
const MARB = ['#fbf8ef', '#e4dccb', '#b8ad94'], GOLD = '#d9b04a', GOLDL = '#f6dc8a';
function plinth(ctx, cx, gy, w, steps = 2, sh = 5) { for (let i = 0; i < steps; i++) { const ww = w * (1 - i * 0.14), y = gy - (i + 1) * sh;
    ctx.fillStyle = lg(ctx, 0, y, 0, y + sh, ['#fffdf6', '#cfc5ad']); ctx.fillRect(cx - ww / 2, y, ww, sh); ctx.fillStyle = 'rgba(120,105,70,0.35)'; ctx.fillRect(cx - ww / 2, y + sh - 1, ww, 1); }
  ctx.fillStyle = GOLD; ctx.fillRect(cx - w * (1 - (steps - 1) * 0.14) / 2, gy - steps * sh, w * (1 - (steps - 1) * 0.14), 1.5); return gy - steps * sh; }
function spireN(ctx, x, base, h, w) { ctx.fillStyle = lg(ctx, x - w, 0, x + w, 0, ['#fffef8', '#e6ddc8', '#a99d82']); ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x - w * 0.55, base - h * 0.85); ctx.lineTo(x, base - h); ctx.lineTo(x + w * 0.55, base - h * 0.85); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(110,95,60,0.5)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x - w * 0.55, base - h * 0.85); ctx.lineTo(x, base - h - 3); ctx.lineTo(x + w * 0.55, base - h * 0.85); ctx.closePath(); ctx.fill(); ctx.fillRect(x - w, base - h * 0.35, w * 2, 1.4); }
function crystalN(ctx, x, y, r, t, p) { glow(ctx, x, y, r * 2.6, `rgba(190,235,255,${0.3 + p * 0.25})`); ctx.fillStyle = lg(ctx, x - r, y - r * 1.6, x + r, y + r, ['#ffffff', '#bfe8ff', '#6fb3e0']);
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.7); ctx.lineTo(x + r, y - r * 0.2); ctx.lineTo(x, y + r * 1.1); ctx.lineTo(x - r, y - r * 0.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y - r * 1.7); ctx.lineTo(x, y + r * 1.1); ctx.stroke(); }
function column(ctx, x, top, base, w) { ctx.fillStyle = lg(ctx, x - w, 0, x + w, 0, ['#d9d0bb', '#fffdf5', '#bdb29a']); ctx.fillRect(x - w, top, w * 2, base - top); ctx.fillStyle = GOLD; ctx.fillRect(x - w - 1, top - 2, w * 2 + 2, 2); ctx.fillRect(x - w - 1, base - 2, w * 2 + 2, 2); }
function nordicBuilding(ctx, ty, X, Y, W, H, cx, gy, t, p, off) {
  const fl = off ? 0.3 : 1, bob = Math.sin(t * 1.5 + cx) * 2;
  switch (ty) {
    case 'sanctum': { const top = plinth(ctx, cx, gy, W * 0.95, 3, 6); for (const dx of [-0.36, 0.36]) spireN(ctx, cx + dx * W, top, H * 0.75, 6); for (const dx of [-0.18, 0.18]) spireN(ctx, cx + dx * W, top, H * 0.55, 5);
      spireN(ctx, cx, top, H * 0.3, W * 0.2); crystalN(ctx, cx, top - H * 0.55 + bob, 9, t, p * fl); break; }
    case 'lightwell': { const top = plinth(ctx, cx, gy, W * 0.8, 2, 5); ctx.fillStyle = lg(ctx, 0, top - 14, 0, top, MARB); ctx.beginPath(); ctx.ellipse(cx, top - 6, W * 0.3, 7, 0, 0, 7); ctx.fill(); ctx.fillRect(cx - W * 0.3, top - 6, W * 0.6, 6);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, top - 6, W * 0.3, 7, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(255,248,210,${(0.35 + p * 0.3) * fl})`; ctx.beginPath(); ctx.moveTo(cx - 8, top - 6); ctx.lineTo(cx - 4, Y - H * 0.6); ctx.lineTo(cx + 4, Y - H * 0.6); ctx.lineTo(cx + 8, top - 6); ctx.closePath(); ctx.fill(); glow(ctx, cx, top - 8, 18, `rgba(255,240,180,${0.5 * fl})`); break; }
    case 'resonator': { const top = plinth(ctx, cx, gy, W * 0.95, 2, 5); for (const dx of [-0.32, 0, 0.32]) { const x = cx + dx * W; column(ctx, x - 5, top - H * 0.6, top, 2); column(ctx, x + 5, top - H * 0.6, top, 2); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, top - H * 0.6, 5, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1; }
      crystalN(ctx, cx - W * 0.16, top - H * 0.42 + bob, 5, t, p * fl); crystalN(ctx, cx + W * 0.16, top - H * 0.42 - bob, 5, t, p * fl); break; }
    case 'temple': { const top = plinth(ctx, cx, gy, W * 0.95, 3, 4); for (let i = 0; i < 4; i++) column(ctx, cx - W * 0.33 + i * W * 0.22, top - H * 0.5, top, 2.6);
      ctx.fillStyle = lg(ctx, 0, top - H * 0.75, 0, top - H * 0.5, ['#fffdf6', '#d8cfb8']); ctx.beginPath(); ctx.moveTo(cx - W * 0.45, top - H * 0.52); ctx.lineTo(cx, top - H * 0.82); ctx.lineTo(cx + W * 0.45, top - H * 0.52); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; ctx.fillStyle = GOLDL; ctx.beginPath(); ctx.arc(cx, top - H * 0.6, 3, 0, 7); ctx.fill(); break; }
    case 'forge': { const top = plinth(ctx, cx, gy, W * 0.95, 2, 6); ctx.fillStyle = lg(ctx, 0, top - H * 0.8, 0, top, MARB); ctx.beginPath(); ctx.moveTo(cx - W * 0.38, top); ctx.lineTo(cx - W * 0.38, top - H * 0.45); ctx.arc(cx, top - H * 0.45, W * 0.38, Math.PI, 0); ctx.lineTo(cx + W * 0.38, top); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4f63'; ctx.beginPath(); ctx.moveTo(cx - W * 0.22, top); ctx.lineTo(cx - W * 0.22, top - H * 0.4); ctx.arc(cx, top - H * 0.4, W * 0.22, Math.PI, 0); ctx.lineTo(cx + W * 0.22, top); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, top - H * 0.45, W * 0.38, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1; glow(ctx, cx, top - H * 0.25, W * 0.2, `rgba(255,220,140,${(0.4 + 0.3 * p) * fl})`); crystalN(ctx, cx, top - H * 0.98 + bob, 7, t, p * fl); break; }
    case 'oracle': { const top = plinth(ctx, cx, gy, W * 0.7, 2, 5); spireN(ctx, cx, top, H * 1.15, 5); const a = t * 1.2; ctx.strokeStyle = 'rgba(217,176,74,0.7)'; ctx.beginPath(); ctx.ellipse(cx, top - H * 0.9, 14, 4, 0, 0, 7); ctx.stroke();
      crystalN(ctx, cx + Math.cos(a) * 14, top - H * 0.9 + Math.sin(a) * 4, 3.5, t, p * fl); break; }
    case 'skygate': { const top = plinth(ctx, cx, gy, W * 0.95, 2, 5); ctx.strokeStyle = lg(ctx, cx - W * 0.4, 0, cx + W * 0.4, 0, ['#c9a23f', '#ffe9a0', '#b28a2e']); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx - W * 0.34, top); ctx.lineTo(cx - W * 0.34, top - H * 0.55); ctx.arc(cx, top - H * 0.55, W * 0.34, Math.PI, 0); ctx.lineTo(cx + W * 0.34, top); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(200,235,255,${(0.25 + 0.2 * p) * fl})`; ctx.beginPath(); ctx.moveTo(cx - W * 0.3, top); ctx.lineTo(cx - W * 0.3, top - H * 0.55); ctx.arc(cx, top - H * 0.55, W * 0.3, Math.PI, 0); ctx.lineTo(cx + W * 0.3, top); ctx.closePath(); ctx.fill(); crystalN(ctx, cx, top - H * 0.55 - W * 0.34, 4, t, p * fl); break; }
    case 'sunlance': { const top = plinth(ctx, cx, gy, W * 0.85, 2, 4); spireN(ctx, cx, top, H * 1.2, 5.5); glow(ctx, cx, top - H * 1.2, 9, `rgba(255,236,160,${(0.5 + 0.4 * p) * fl})`); break; }
    default: { const top = plinth(ctx, cx, gy, W * 0.8, 2, 5); spireN(ctx, cx, top, H * 0.7, 7); }
  }
}
// ---- Grey: brushed silver domes and discs, purple seams
const SILV = ['#f4f6fa', '#b9bec8', '#6e7380', '#3b3e47'];
function dome(ctx, x, base, rx, ry) { ctx.fillStyle = lg(ctx, x - rx, base - ry, x + rx * 0.6, base, SILV); ctx.beginPath(); ctx.ellipse(x, base, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, base, rx * 0.78, ry * 0.8, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); ctx.lineWidth = 1; }
function disc(ctx, x, y, rx, ry) { ctx.fillStyle = lg(ctx, 0, y - ry, 0, y + ry, ['#eef1f5', '#a9afb9', '#4d515b']); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(40,42,50,0.6)'; ctx.stroke(); }
function seam(ctx, x, y, rx, ry, p, fl) { ctx.strokeStyle = `rgba(178,110,255,${(0.55 + 0.4 * p) * fl})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0.05, Math.PI - 0.05); ctx.stroke(); ctx.lineWidth = 1; }
function lights(ctx, x, y, rx, ry, n, t, fl) { for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI, on = (0.5 + 0.5 * Math.sin(t * 5 + i * 1.3)) * fl; ctx.fillStyle = i % 2 ? `rgba(190,120,255,${on})` : `rgba(160,255,130,${on})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rx, y + Math.sin(a) * ry, 1.4, 0, 7); ctx.fill(); } }
function greyBuilding(ctx, ty, X, Y, W, H, cx, gy, t, p, off) {
  const fl = off ? 0.25 : 1, hov = Math.sin(t * 1.4 + cx) * 2;
  disc(ctx, cx, gy - 4, W * 0.47, H * 0.2); seam(ctx, cx, gy - 4, W * 0.4, H * 0.15, p, fl); // landing pad every Grey site sits on
  switch (ty) {
    case 'nexus': dome(ctx, cx, gy - 6, W * 0.38, H * 0.55); seam(ctx, cx, gy - 6, W * 0.38, H * 0.08, p, fl); disc(ctx, cx, gy - H * 0.82 + hov, W * 0.3, 6); lights(ctx, cx, gy - H * 0.82 + hov, W * 0.28, 4, 8, t, fl);
      glow(ctx, cx, gy - H * 0.7 + hov, 14, `rgba(170,100,255,${0.4 * fl})`); break;
    case 'reactor': { ctx.fillStyle = '#4b4f5a'; ctx.fillRect(cx - 3, gy - 22, 6, 18); const y = gy - 26 + hov * 0.5; glow(ctx, cx, y, 20, `rgba(175,95,255,${(0.45 + 0.35 * p) * fl})`);
      ctx.fillStyle = lg(ctx, cx - 10, y - 10, cx + 8, y + 10, ['#ffffff', '#c9b6ff', '#6b4fb8']); ctx.beginPath(); ctx.arc(cx, y, 10, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(230,230,240,0.8)'; ctx.beginPath(); ctx.ellipse(cx, y, 15, 4, 0.3 + t * 0.5 % 6.28, 0, 7); ctx.stroke(); break; }
    case 'extractor': dome(ctx, cx - W * 0.12, gy - 6, W * 0.26, H * 0.45); ctx.strokeStyle = '#8c919c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + W * 0.05, gy - H * 0.3); ctx.quadraticCurveTo(cx + W * 0.36, gy - H * 0.55, cx + W * 0.4, gy - 6); ctx.stroke(); ctx.lineWidth = 1;
      glow(ctx, cx + W * 0.4, gy - 6, 9, `rgba(150,255,110,${(0.4 + 0.4 * p) * fl})`); lights(ctx, cx - W * 0.12, gy - 8, W * 0.22, 3, 5, t, fl); break;
    case 'vat': for (const dx of [-0.24, 0, 0.24]) { const x = cx + dx * W, hh = H * 0.55; ctx.fillStyle = 'rgba(160,230,190,0.35)'; ctx.fillRect(x - 6, gy - 8 - hh, 12, hh); ctx.fillStyle = `rgba(130,255,150,${0.35 + 0.2 * p})`; ctx.fillRect(x - 5, gy - 8 - hh * 0.75, 10, hh * 0.75);
        ctx.fillStyle = 'rgba(80,90,100,0.7)'; ctx.beginPath(); ctx.ellipse(x, gy - 8 - hh * 0.4, 2.5, 4, 0, 0, 7); ctx.fill(); disc(ctx, x, gy - 8 - hh, 7, 2.5); ctx.fillStyle = '#8b5bdc'; ctx.fillRect(x - 6, gy - 9, 12, 2); } break;
    case 'assembly': disc(ctx, cx, gy - 10, W * 0.42, H * 0.17); dome(ctx, cx + W * 0.16, gy - 12, W * 0.16, H * 0.3); ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 3; const ar = Math.sin(t * 1.6) * 0.4; ctx.beginPath(); ctx.moveTo(cx - W * 0.25, gy - 12); ctx.lineTo(cx - W * 0.2, gy - H * 0.55); ctx.lineTo(cx - W * 0.05 + ar * 8, gy - H * 0.45); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(200,150,255,${(0.6 + 0.4 * p) * fl})`; ctx.beginPath(); ctx.arc(cx - W * 0.05 + ar * 8, gy - H * 0.45, 2, 0, 7); ctx.fill(); lights(ctx, cx, gy - 10, W * 0.4, H * 0.14, 10, t, fl); break;
    case 'beacon': ctx.fillStyle = lg(ctx, cx - 3, 0, cx + 3, 0, ['#c9ced8', '#ffffff', '#7d828d']); ctx.fillRect(cx - 2.5, gy - H * 1.05, 5, H * 1.0); for (let i = 0; i < 3; i++) { const y = gy - H * (0.45 + i * 0.25), r = 12 - i * 3; disc(ctx, cx, y, r, r * 0.3); seam(ctx, cx, y, r * 0.8, r * 0.22, Math.sin(t * 4 - i), fl); }
      glow(ctx, cx, gy - H * 1.08, 10, `rgba(180,110,255,${(0.5 + 0.4 * p) * fl})`); break;
    case 'hangar': dome(ctx, cx, gy - 6, W * 0.44, H * 0.62); ctx.fillStyle = '#16151d'; ctx.beginPath(); ctx.ellipse(cx, gy - 6, W * 0.22, H * 0.36, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(175,110,255,${(0.3 + 0.3 * p) * fl})`; ctx.fillRect(cx - W * 0.22, gy - 8, W * 0.44, 2); seam(ctx, cx, gy - 6, W * 0.44, H * 0.08, p, fl); break;
    case 'psitower': { ctx.fillStyle = lg(ctx, cx - 5, 0, cx + 5, 0, ['#a7acb7', '#f5f6fa', '#686d78']); ctx.beginPath(); ctx.moveTo(cx - 6, gy - 6); ctx.lineTo(cx - 2.5, gy - H * 1.0); ctx.lineTo(cx + 2.5, gy - H * 1.0); ctx.lineTo(cx + 6, gy - 6); ctx.closePath(); ctx.fill();
      const y = gy - H * 1.25 + hov; glow(ctx, cx, y, 12, `rgba(185,110,255,${(0.5 + 0.4 * p) * fl})`); ctx.fillStyle = '#f2e8ff'; ctx.beginPath(); ctx.arc(cx, y, 4, 0, 7); ctx.fill(); break; }
    default: dome(ctx, cx, gy - 6, W * 0.35, H * 0.4);
  }
}
export const isAlienBuilding = s => s && (s.faction === 'nordic' || s.faction === 'grey');

// ---- v10.2 Grey air: classic flying saucers (metal disc, dome, ring of lights underneath, slow spin + wobble) and white electric orbs
const SAUCER = { minisaucer: 9, scoutsaucer: 13, saucer: 19, warsaucer: 23, mothership: 46 };
function saucerShape(ctx, x, y, R, t, id, tilt, lights = 10) {
  const H = R * 0.32;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  // underside glow + rotating light ring
  glow(ctx, 0, H * 0.5, R * 0.9, 'rgba(160,255,140,0.35)');
  for (let i = 0; i < lights; i++) { const a = t * 1.6 + i / lights * Math.PI * 2, lx = Math.cos(a) * R * 0.72, ly = H * 0.35 + Math.sin(a) * H * 0.35; if (Math.sin(a) < -0.2) continue;
    const on = 0.55 + 0.45 * Math.sin(t * 8 + i * 1.7); ctx.fillStyle = i % 3 === 0 ? `rgba(255,120,90,${on})` : `rgba(170,255,150,${on})`; ctx.beginPath(); ctx.arc(lx, ly, Math.max(1, R * 0.07), 0, 7); ctx.fill(); }
  // disc
  const g = ctx.createLinearGradient(0, -H, 0, H); g.addColorStop(0, '#eef1f4'); g.addColorStop(0.45, '#a9b0b8'); g.addColorStop(0.55, '#6c737c'); g.addColorStop(1, '#3d4248');
  ctx.fillStyle = g; ctx.strokeStyle = '#2a2e33'; ctx.lineWidth = Math.max(0.8, R * 0.04); ctx.beginPath(); ctx.ellipse(0, 0, R, H, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(0, -H * 0.1, R * 0.82, H * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  // rim panel ticks spin
  ctx.strokeStyle = 'rgba(40,44,50,0.6)'; for (let i = 0; i < 12; i++) { const a = t * 0.8 + i / 12 * Math.PI * 2; if (Math.sin(a) < 0) continue; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * H * 0.9); ctx.lineTo(Math.cos(a) * R * 0.6, Math.sin(a) * H * 0.6); ctx.stroke(); }
  // dome
  const d = ctx.createRadialGradient(-R * 0.12, -H * 1.5, 1, 0, -H * 0.8, R * 0.45); d.addColorStop(0, 'rgba(240,255,250,0.95)'); d.addColorStop(0.5, 'rgba(150,210,200,0.8)'); d.addColorStop(1, 'rgba(60,90,95,0.85)');
  ctx.fillStyle = d; ctx.beginPath(); ctx.ellipse(0, -H * 0.55, R * 0.38, H * 1.3, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2a2e33'; ctx.stroke();
  ctx.restore(); ctx.lineWidth = 1; return H;
}
// v10.3: saucers use pixel-faithful cutouts from grey-craft-concept.jpg; procedural only for bays, underglow, lights and motion
const SAUCER_SPR = { minisaucer: 'gs_small', scoutsaucer: 'gs_scout', saucer: 'gs_saucer', warsaucer: 'gs_saucer', mothership: 'gs_mother' };
// mothership hull bays (fractions of sprite width/height): six recessed hatches set into the upper hull band
const BAYS = [[-0.33, 0.43], [-0.18, 0.38], [-0.04, 0.36], [0.11, 0.37], [0.25, 0.40], [0.38, 0.47]];
function drawSaucer(ctx, u, t, R) {
  const sp = getSprite(SAUCER_SPR[u.type], 0); if (sp) return drawSaucerSprite(ctx, u, t, R, sp);
  return drawSaucerVec(ctx, u, t, R); }
function drawSaucerSprite(ctx, u, t, R, sp) {
  const id = u.id || 0, W = R * (u.type === 'mothership' ? 3.6 : 2.4), H = W * sp.aspect, alt = 26 + R * 0.5 + Math.sin(t * 1.8 + id) * 2.5, y = u.y - alt;
  const turn = Math.max(-0.12, Math.min(0.12, ((u.angle || 0) - (u._pa ?? u.angle ?? 0)) * 3)); u._pa = u.angle; u._bank = (u._bank || 0) * 0.9 + turn * 0.1;
  const tilt = Math.sin(t * 1.3 + id * 2) * 0.035 + u._bank;
  airShadow(ctx, u.x, u.y + 4, W * 0.42, W * 0.12, alt);
  if (u.beam && !u.beam.dead) { const b = u.beam, gr = ctx.createLinearGradient(u.x, y, b.x, b.y); gr.addColorStop(0, 'rgba(120,255,110,0.75)'); gr.addColorStop(1, 'rgba(120,255,110,0.18)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(u.x - W * 0.12, y + H * 0.35); ctx.lineTo(u.x + W * 0.12, y + H * 0.35); ctx.lineTo(b.x + 15, b.y + 4); ctx.lineTo(b.x - 15, b.y + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,255,190,0.5)'; for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(u.x + (b.x - u.x) * k, y + (b.y - y) * k, W * 0.12 + k * 10, 3 + k * 2, 0, 0, 7); ctx.stroke(); } }
  // subtle underglow + rotating purple/green belly lights
  glow(ctx, u.x, y + H * 0.38, W * 0.42, 'rgba(170,90,255,0.35)', 0.6 + 0.2 * Math.sin(t * 3 + id));
  ctx.save(); ctx.translate(u.x, y); ctx.rotate(tilt); ctx.drawImage(sp.img, -W / 2, -H / 2, W, H);
  const n = u.type === 'mothership' ? 14 : 7;
  for (let i = 0; i < n; i++) { const a = t * 1.4 + i / n * Math.PI * 2; if (Math.sin(a) < 0) continue; const on = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.9);
    ctx.fillStyle = i % 2 ? `rgba(190,110,255,${on})` : `rgba(150,255,120,${on})`; ctx.beginPath(); ctx.arc(Math.cos(a) * W * 0.36, H * 0.22 + Math.sin(a) * H * 0.1, Math.max(1, W * 0.012), 0, 7); ctx.fill(); }
  if (u.type === 'mothership') { const have = u.docked || 0, mini = getSprite('gs_small', 0);
    BAYS.forEach(([bx, by], i) => { const x = bx * W, yy = -H / 2 + by * H, bw = W * 0.05, bh = bw * 0.38;
      ctx.fillStyle = 'rgba(8,8,12,0.92)'; ctx.beginPath(); ctx.ellipse(x, yy, bw, bh, 0, 0, 7); ctx.fill(); // recessed bay
      ctx.strokeStyle = 'rgba(200,190,170,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, yy + 0.5, bw, bh, 0, 0.1, Math.PI - 0.1); ctx.stroke(); // lit lower lip
      if (i < have && mini) { ctx.save(); ctx.beginPath(); ctx.ellipse(x, yy, bw * 0.95, bh * 1.15, 0, 0, 7); ctx.clip();
        const mw = bw * 1.7; ctx.drawImage(mini.img, x - mw / 2, yy - mw * mini.aspect * 0.35, mw, mw * mini.aspect); ctx.restore(); }
      else { ctx.fillStyle = `rgba(150,255,120,${0.25 + 0.2 * Math.sin(t * 4 + i)})`; ctx.beginPath(); ctx.ellipse(x, yy, bw * 0.5, bh * 0.4, 0, 0, 7); ctx.fill(); } }); }
  ctx.restore();
  if (u.type === 'minisaucer' && u.docked) { ctx.fillStyle = '#eaf6ff'; for (let i = 0; i < u.docked; i++) { ctx.beginPath(); ctx.arc(u.x - 4 + i * 4, y + H * 0.5 + 3, 1.3, 0, 7); ctx.fill(); } }
  return y - H / 2 - 2; }
function drawSaucerVec(ctx, u, t, R) {
  const id = u.id || 0, alt = 26 + R * 0.5 + Math.sin(t * 1.8 + id) * 2.5, tilt = Math.sin(t * 1.3 + id * 2) * 0.07 + Math.cos(u.angle || 0) * 0.04, y = u.y - alt;
  airShadow(ctx, u.x, u.y + 2, R * 0.9, R * 0.28, alt);
  if (u.beam && !u.beam.dead) { const b = u.beam, gr = ctx.createLinearGradient(u.x, y, b.x, b.y); gr.addColorStop(0, 'rgba(120,255,110,0.75)'); gr.addColorStop(1, 'rgba(120,255,110,0.18)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(u.x - R * 0.35, y + 4); ctx.lineTo(u.x + R * 0.35, y + 4); ctx.lineTo(b.x + 15, b.y + 4); ctx.lineTo(b.x - 15, b.y + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,255,190,0.5)'; for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(u.x + (b.x - u.x) * k, y + (b.y - y) * k, R * 0.35 + k * 10, 3 + k * 2, 0, 0, 7); ctx.stroke(); } }
  const H = saucerShape(ctx, u.x, y, R, t, id, tilt, u.type === 'mothership' ? 18 : 10);
  if (u.type === 'mothership') { // six docked mini-saucers around the top; empty slots show as dark pads
    const n = u.stats.interceptors || 6, have = u.docked || 0;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + t * 0.25, sx = u.x + Math.cos(a) * R * 0.66, sy = y - H * 0.35 + Math.sin(a) * H * 0.62;
      if (i < have) saucerShape(ctx, sx, sy - 3, 7, t * 1.3, i, 0, 6); else { ctx.fillStyle = 'rgba(25,30,35,0.75)'; ctx.beginPath(); ctx.ellipse(sx, sy, 6, 2.2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(150,255,140,0.4)'; ctx.stroke(); } } }
  if (u.wing && u.docked) { ctx.fillStyle = '#eaf6ff'; for (let i = 0; i < u.docked; i++) { ctx.beginPath(); ctx.arc(u.x - 4 + i * 4, y + H + 3, 1.3, 0, 7); ctx.fill(); } }
  return y - H * 2;
}
function drawOrb(ctx, u, t) {
  const id = u.id || 0, big = u.type === 'probe', r = big ? 5 : 3.2, jx = Math.sin(t * 7.3 + id) * 3 + Math.sin(t * 13.1 + id * 3) * 1.5, jy = Math.cos(t * 6.1 + id * 2) * 3;
  const x = u.x + jx, y = u.y - (big ? 26 : 22) + jy;
  airShadow(ctx, u.x, u.y + 1, r * 1.4, r * 0.5, big ? 26 : 22);
  glow(ctx, x, y, r * 4, 'rgba(225,240,255,0.55)', 0.8 + 0.2 * Math.sin(t * 20 + id));
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e6f2ff'); g.addColorStop(1, '#9fc6ff');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(200,230,255,0.85)'; ctx.lineWidth = 0.8; for (let i = 0; i < 2; i++) { let a = Math.random() * 7, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(px, py);
    for (let k = 0; k < 3; k++) { px += Math.cos(a) * r * 0.7 + (Math.random() - 0.5) * 3; py += Math.sin(a) * r * 0.7 + (Math.random() - 0.5) * 3; ctx.lineTo(px, py); } ctx.stroke(); }
  ctx.lineWidth = 1; ctx.strokeStyle = TEAMC[u.team]; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(u.x, u.y + 1, r * 1.6, r * 0.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  return y - r - 3;
}
function drawBike(ctx, u, t, face, moving) {
  const b = moving ? Math.abs(Math.sin(t * 20 + (u.id || 0))) * 0.8 : 0, spin = moving ? t * 18 : 0;
  shadow(ctx, u.x, u.y + 2, 11, 3.5);
  ctx.save(); ctx.translate(u.x, u.y); ctx.scale(face, 1);
  if (moving) { ctx.fillStyle = 'rgba(200,175,130,0.3)'; ctx.beginPath(); ctx.arc(-14, -3, 3 + Math.random() * 2, 0, 7); ctx.fill(); }
  wheel(ctx, -8, -4, 4.5, spin); wheel(ctx, 8, -4, 4.5, spin);
  ctx.strokeStyle = '#2b2a24'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-2, -10 - b); ctx.lineTo(6, -10 - b); ctx.lineTo(8, -4); ctx.stroke();
  const g = ctx.createLinearGradient(0, -14, 0, -7); g.addColorStop(0, '#a4925a'); g.addColorStop(1, '#5a4f2c'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-7, -9 - b); ctx.lineTo(7, -10 - b); ctx.lineTo(9, -13 - b); ctx.lineTo(-4, -13 - b); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4e5a3a'; ctx.beginPath(); ctx.ellipse(-1, -18 - b, 3, 5, 0.35, 0, 7); ctx.fill(); // rider
  ctx.fillStyle = '#3a3f33'; ctx.beginPath(); ctx.arc(1, -24 - b, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = u.team === ME ? '#4fa7d8' : '#c8402c'; ctx.fillRect(-1, -25 - b, 4, 1.4);
  ctx.strokeStyle = '#2b2a24'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(1, -16 - b); ctx.lineTo(7, -15 - b); ctx.stroke();
  ctx.fillStyle = '#303128'; ctx.fillRect(6, -15 - b, 7, 1.6);
  if (u.fired > 0) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(14, -14 - b, 1.8, 0, 7); ctx.fill(); }
  ctx.restore(); ctx.lineWidth = 1; return u.y - 28;
}
