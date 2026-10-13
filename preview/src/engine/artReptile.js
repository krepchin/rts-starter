import { ME } from './local.js?v=10.2p';
// v10 art: Reptilian units (sprites cut from Kent's concept art, assets/r_*.png, with code fallbacks), drones, Brood Ship, eggs,
// organic structures (painted code art), the human Dune Buggy and Monster Truck, and new weapon effects.
import { TILE, UNITS, BUILDINGS } from '../data/stats.js?v=10.2p';
import { getSprite } from './sprites.js?v=10.2p';

const SPR = { raider: ['r_raider', 30], spitter: ['r_spitter', 28], brute: ['r_brute', 44], shaman: ['r_shaman', 38], hatchling: ['r_raider', 19],
  spark: ['r_spark', 20], lance: ['r_lance', 30], hiveorb: ['r_hive', 54],
  // v10.1 Nordics + Greys (cut from Kent's faction concept sheets)
  sentinel: ['n_sentinel', 30], seer: ['n_seer', 32], guardian: ['n_guardian', 32], tallwhite: ['n_tallwhite', 46], skiff: ['n_skiff', 26], harmonizer: ['n_skiff', 20],
  lightcraft: ['n_lightcraft', 10], lightship: ['n_lightship', 30],
  greydrone: ['g_drone', 20], psionic: ['g_psionic', 24], abductor: ['g_abductor', 26], hybrid: ['g_hybrid', 28], crawler: ['g_crawler', 15],
  reaper: ['g_saucer', 14], };
const HOVER_GLOW = { nordic: 'rgba(255,245,200,0.5)', grey: 'rgba(190,120,255,0.45)' };
export const isFactionArt = type => !!SPR[type] || ['egg', 'broodship', 'grazer', 'buggy', 'truck', 'bike', 'probe', 'orbling', 'minisaucer', 'scoutsaucer', 'warsaucer', 'saucer', 'mothership'].includes(type);
const TEAMC = { 0: '#3fa9ff', 1: '#ff4a3a' };
function shadow(ctx, x, y, rx, ry, a = 0.3) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }
function glow(ctx, x, y, r, c, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(120,255,80,0)'); ctx.globalAlpha *= a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha /= a; }

// returns the top y of the drawn unit (for hp bars)
export function drawFactionUnit(ctx, u, t, viewer = 0) {
  const tp = u.type, face = Math.cos(u.angle || 0) >= 0 ? 1 : -1, moving = (u.order && u.order.type !== 'cast') || u.leap;
  const hidden = u.cloaked && u.team !== viewer && !u.detected; if (hidden) return null;
  if (u.life !== undefined && u.lifeMax) ctx.globalAlpha = Math.min(1, 0.35 + u.life / 8);
  let top = u.y - 30;
  if (SPR[tp]) {
    const [name, H] = SPR[tp], hover = UNITS[tp].hover || UNITS[tp].air, sp = getSprite(name, 0);
    let alt = hover ? 12 + Math.sin(t * 3 + (u.id || 0)) * 2.5 : (u.hop || 0), bob = !hover && moving ? Math.abs(Math.sin(t * 9 + (u.id || 0))) * 1.6 : 0;
    shadow(ctx, u.x, u.y + 1, H * (hover ? 0.42 : 0.35), H * 0.12, hover ? 0.22 : 0.3);
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
    ctx.scale(face * (tp === 'spark' ? -1 : 1), 1);
    if (sp) { const w = H / sp.aspect; ctx.drawImage(sp.img, -w / 2, -H, w, H); }
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
  const lift = 34 + Math.sin(t * 1.4 + (u.id || 0)) * 3, x = u.x, y = u.y - lift, flap = Math.sin(t * 3 + (u.id || 0)) * 0.5 + 0.5;
  shadow(ctx, u.x, u.y + 4, 44, 12, 0.25);
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  // membrane wings (behind)
  for (const s of [-1, 1]) { const tipX = s * 50, tipY = -44 - flap * 16; ctx.fillStyle = 'rgba(150,128,84,0.72)'; ctx.strokeStyle = '#3a3220'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(s * 4, -16); ctx.quadraticCurveTo(s * 18, -40 - flap * 12, tipX, tipY); ctx.quadraticCurveTo(s * 40, -26, s * 44, -12 + flap * 2);
    ctx.quadraticCurveTo(s * 32, -18, s * 26, -10); ctx.quadraticCurveTo(s * 16, -16, s * 4, -16); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,56,30,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); for (const [ex, ey] of [[tipX, tipY], [s * 44, -12 + flap * 2], [s * 26, -10]]) { ctx.moveTo(s * 5, -16); ctx.lineTo(ex, ey); } ctx.stroke(); }
  // scaled hull
  const g = ctx.createLinearGradient(0, -22, 0, 18); g.addColorStop(0, '#8a7a4e'); g.addColorStop(0.5, '#4f4a2c'); g.addColorStop(1, '#25230f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(40, -2); ctx.quadraticCurveTo(30, -20, 0, -20); ctx.quadraticCurveTo(-36, -18, -44, 0); ctx.quadraticCurveTo(-30, 16, 4, 14); ctx.quadraticCurveTo(30, 12, 40, -2); ctx.fill();
  ctx.strokeStyle = '#1e1a0c'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.strokeStyle = 'rgba(30,26,12,0.55)'; ctx.lineWidth = 1; for (let i = -36; i < 34; i += 7) { ctx.beginPath(); ctx.arc(i, -10, 5, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(i + 3, -2, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
  // glowing sacs underneath
  const p = 0.5 + 0.5 * Math.sin(t * 4 + (u.id || 0));
  for (const [sx, sy, r] of [[-18, 10, 7], [-2, 13, 8], [16, 10, 6]]) { glow(ctx, sx, sy, r * 2.2, `rgba(160,255,80,${0.35 + p * 0.3})`); ctx.fillStyle = `rgba(170,240,90,${0.75 + p * 0.2})`; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a4a18'; ctx.stroke(); }
  // head + eye
  ctx.fillStyle = '#3b3620'; ctx.beginPath(); ctx.ellipse(38, -4, 9, 7, 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#d8ff6a'; ctx.beginPath(); ctx.arc(42, -6, 2, 0, 7); ctx.fill();
  // dangling tendrils
  ctx.strokeStyle = 'rgba(60,70,30,0.8)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-24 + i * 12, 12); ctx.quadraticCurveTo(-26 + i * 12 + Math.sin(t * 3 + i) * 4, 22, -22 + i * 12, 28 + Math.sin(t * 2 + i) * 3); ctx.stroke(); }
  ctx.restore(); ctx.strokeStyle = TEAMC[u.team]; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 44, 12, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  return y - 26;
}
function drawGrazer(ctx, u, t, face, moving) {
  shadow(ctx, u.x, u.y + 2, 18, 6);
  ctx.save(); ctx.translate(u.x, u.y - 8); ctx.scale(face, 1); const st = moving ? Math.sin(t * 14) * 2 : 0;
  ctx.strokeStyle = '#2a2614'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 2); ctx.lineTo(i * 8 - 4 + st * (i % 2 ? 1 : -1), 9); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, -12, 0, 6); g.addColorStop(0, '#8d7f4c'); g.addColorStop(1, '#3a3418'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -2, 17, 10, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#1e1a0c'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 7); ctx.stroke();
  const f = Math.min(1, (u.load || 0) / u.stats.capacity); glow(ctx, -6, -4, 10, `rgba(150,255,80,${0.2 + f * 0.6})`); ctx.fillStyle = `rgba(150,240,80,${0.3 + f * 0.6})`; ctx.beginPath(); ctx.ellipse(-6, -4, 6, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2d2a14'; ctx.beginPath(); ctx.ellipse(17, 0, 6, 5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a3418'; ctx.beginPath(); ctx.moveTo(21, 2); ctx.lineTo(26, 5); ctx.moveTo(21, -2); ctx.lineTo(26, -4); ctx.stroke();
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
  const built = Math.min(1, (b.age || 0) / 0.8);
  shadow(ctx, cx + 4, Y + H - 4, W * 0.5, H * 0.24, 0.3);
  ctx.save(); ctx.translate(cx, Y + H - 4); ctx.scale(1, 0.4 + 0.6 * built); ctx.translate(-cx, -(Y + H - 4));
  const mound = (rx, ry, oy = 0) => { const g = ctx.createRadialGradient(cx - rx * 0.3, Y + H - ry - oy - ry * 0.4, 2, cx, Y + H - ry * 0.6 - oy, rx * 1.1);
    g.addColorStop(0, '#9c8a58'); g.addColorStop(0.55, '#5e5430'); g.addColorStop(1, '#2a2612'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, Y + H - ry * 0.55 - oy, rx, ry, 0, Math.PI, 0); ctx.quadraticCurveTo(cx + rx * 0.9, Y + H - oy + 2, cx, Y + H - oy + 2); ctx.quadraticCurveTo(cx - rx * 0.9, Y + H - oy + 2, cx - rx, Y + H - ry * 0.55 - oy); ctx.fill();
    ctx.strokeStyle = 'rgba(25,22,10,0.6)'; ctx.lineWidth = 1; for (let i = 0; i < 9; i++) { const a = Math.PI + (i + 0.5) / 9 * Math.PI; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * 0.75, Y + H - ry * 0.55 - oy + Math.sin(a) * ry * 0.7, 4, 0.2, Math.PI - 0.2); ctx.stroke(); } };
  const sac = (x, y, r) => { glow(ctx, x, y, r * 2.4, `rgba(150,255,80,${0.3 + p * 0.35})`); ctx.fillStyle = `rgba(165,240,85,${0.7 + p * 0.25})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#33441a'; ctx.stroke(); };
  const spike = (x, y, h, a = 0) => { ctx.fillStyle = '#d8c89a'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x + a * 0.5, y - h * 0.6, x + a, y - h); ctx.quadraticCurveTo(x + 1, y - h * 0.5, x + 3, y); ctx.fill(); ctx.strokeStyle = '#4a4228'; ctx.stroke(); };
  switch (b.type) {
    case 'hive': mound(W * 0.48, H * 0.62); for (const [dx, h, a] of [[-30, 22, -8], [-14, 30, -4], [6, 34, 3], [24, 24, 8]]) spike(cx + dx, Y + H * 0.42, h, a);
      ctx.fillStyle = '#140f06'; ctx.beginPath(); ctx.ellipse(cx, Y + H - 16, 14, 9, 0, 0, 7); ctx.fill(); sac(cx, Y + H - 16, 7); sac(cx - 26, Y + H - 24, 5); sac(cx + 28, Y + H - 22, 5); break;
    case 'heart': mound(W * 0.42, H * 0.4); { const s = 1 + p * 0.1; ctx.save(); ctx.translate(cx, Y + H * 0.48); ctx.scale(s, s); sac(0, 0, 13); ctx.restore(); }
      ctx.strokeStyle = 'rgba(70,30,20,0.8)'; ctx.lineWidth = 2; for (const a of [-2.4, -1.6, -0.8]) { ctx.beginPath(); ctx.moveTo(cx, Y + H * 0.5); ctx.quadraticCurveTo(cx + Math.cos(a) * 18, Y + H * 0.6, cx + Math.cos(a) * 26, Y + H - 6); ctx.stroke(); } ctx.lineWidth = 1; break;
    case 'digester': mound(W * 0.46, H * 0.55); sac(cx - 14, Y + H * 0.45, 11); sac(cx + 16, Y + H * 0.52, 8);
      ctx.strokeStyle = '#4a4228'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 30, Y + H - 6); ctx.quadraticCurveTo(cx + 44, Y + H * 0.4, cx + 30, Y + 8); ctx.stroke(); ctx.lineWidth = 1; break;
    case 'spawnpool': ctx.fillStyle = '#3a3218'; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.46, H * 0.32, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(120,220,60,${0.75 + p * 0.2})`; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.38, H * 0.24, 0, 0, 7); ctx.fill(); glow(ctx, cx, Y + H * 0.62, W * 0.45, 'rgba(160,255,90,0.35)');
      for (let i = 0; i < 3; i++) { const bx = cx + Math.sin(t * 1.3 + i * 2) * 14, by = Y + H * 0.62 + Math.cos(t * 1.7 + i) * 5; ctx.fillStyle = 'rgba(220,255,160,0.7)'; ctx.beginPath(); ctx.arc(bx, by, 2 + ((t * 2 + i) % 1) * 2, 0, 7); ctx.fill(); }
      for (const dx of [-24, -8, 8, 24]) { ctx.strokeStyle = '#d8c89a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + dx, Y + H * 0.85); ctx.quadraticCurveTo(cx + dx * 0.6, Y + H * 0.15, cx, Y + H * 0.22); ctx.stroke(); } ctx.lineWidth = 1; break;
    case 'dronenest': mound(W * 0.47, H * 0.7); for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { const hx = cx - 22 + i * 22 + r * 11, hy = Y + H * 0.38 + r * 18;
        ctx.fillStyle = '#1b1709'; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 7; ctx.lineTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 8); } ctx.fill(); sac(hx, hy, 4 + p * 1.5); } break;
    case 'seer': mound(W * 0.36, H * 0.3); ctx.strokeStyle = '#5e5430'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx, Y + H - 10); ctx.quadraticCurveTo(cx - 10 + Math.sin(t) * 3, Y + H * 0.3, cx + 4, Y - 6); ctx.stroke(); ctx.lineWidth = 1;
      { const ex = cx + 4 + Math.sin(t) * 1.5, ey = Y - 10; ctx.fillStyle = '#e8e0b0'; ctx.beginPath(); ctx.ellipse(ex, ey, 9, 7, 0, 0, 7); ctx.fill(); glow(ctx, ex, ey, 16, 'rgba(170,255,90,0.5)');
        ctx.fillStyle = '#4c9a1a'; ctx.beginPath(); ctx.arc(ex + Math.sin(t * 0.7) * 3, ey, 3.8, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(ex + Math.sin(t * 0.7) * 3 - 0.8, ey - 3, 1.6, 6); } break;
    case 'broodspire': mound(W * 0.46, H * 0.5); for (const [dx, h] of [[-18, 40], [0, 58], [18, 36]]) { ctx.fillStyle = '#6b5f36'; ctx.beginPath(); ctx.moveTo(cx + dx - 8, Y + H * 0.6); ctx.quadraticCurveTo(cx + dx - 6, Y + H * 0.6 - h * 0.6, cx + dx + Math.sin(t + dx) * 2, Y + H * 0.6 - h); ctx.quadraticCurveTo(cx + dx + 4, Y + H * 0.6 - h * 0.5, cx + dx + 8, Y + H * 0.6); ctx.fill(); ctx.strokeStyle = '#2a2612'; ctx.stroke(); }
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
  const s = b.stats, P = PADS[s.faction], X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE, cx = X + W / 2, built = Math.min(1, (b.age ?? 9) / 0.8), p = 0.5 + 0.5 * Math.sin(t * 2 + (b.id || 0));
  shadow(ctx, cx + 4, Y + H - 6, W * 0.52, H * 0.26, 0.35);
  const g = ctx.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, P.a); g.addColorStop(1, P.b);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.48, H * 0.34, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = P.ring; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5 + 0.4 * p; ctx.beginPath(); ctx.ellipse(cx, Y + H * 0.62, W * 0.4, H * 0.27, 0, 0, 7); ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + t * 0.3; ctx.fillStyle = P.ring; ctx.fillRect(cx + Math.cos(a) * W * 0.4 - 1, Y + H * 0.62 + Math.sin(a) * H * 0.27 - 1, 2, 2); }
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  const sp = getSprite(s.art, 0);
  if (sp) { const k = ART_SCALE[s.art] || 1, sw0 = W * 0.95 * k, sh0 = sw0 * sp.aspect, sh = Math.min(sh0, H * 2.1 * k), sw = sh / sp.aspect;
    glow(ctx, cx, Y + H * 0.5, W * 0.55, P.glow, 0.5 + 0.4 * p);
    ctx.save(); ctx.translate(cx, Y + H * 0.8); if (b.faceRight === false) ctx.scale(-1, 1); ctx.scale(1, built);
    if (b.powered === false) ctx.filter = 'brightness(0.55)'; ctx.drawImage(sp.img, -sw / 2, -sh, sw, sh); ctx.filter = 'none'; ctx.restore(); }
  ctx.fillStyle = TEAMC[b.team] || '#fff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(cx, Y + H - 4, 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (s.weapon && b.flash > 0 && b.target) { ctx.strokeStyle = s.weapon.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, Y - 6); ctx.lineTo(b.target.x, b.target.y); ctx.stroke(); ctx.lineWidth = 1; }
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
function drawSaucer(ctx, u, t, R) {
  const id = u.id || 0, alt = 26 + R * 0.5 + Math.sin(t * 1.8 + id) * 2.5, tilt = Math.sin(t * 1.3 + id * 2) * 0.07 + Math.cos(u.angle || 0) * 0.04, y = u.y - alt;
  shadow(ctx, u.x, u.y + 2, R * 0.9, R * 0.28, 0.22);
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
  shadow(ctx, u.x, u.y + 1, r * 1.4, r * 0.5, 0.18);
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
