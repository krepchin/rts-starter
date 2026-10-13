import { TEAM_COLORS } from '../data/stats.js?v=10.2p';
import { getSprite } from './sprites.js?v=10.2p';
// v8 code-drawn art for the Mobile Yard crawler and the Base Walker (no image assets needed, so nothing to fall back from).
// Same 3/4 view as the building art; flipped horizontally by heading. Ground point = (u.x, u.y).
const PAL = { 0: { hull: '#7d8a92', dark: '#4b555c', light: '#b4c0c6', trim: '#3fa9ff', glass: '#9fe2ff' },
              1: { hull: '#8f7f78', dark: '#5a4b46', light: '#c9b6ad', trim: '#ff4a3a', glass: '#ffb59f' } };
function box(ctx, x, y, w, h, P, d = 6) { // pseudo-3D block: top face + front face + side
  ctx.fillStyle = P.light; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d, y - d); ctx.lineTo(x + w + d, y - d); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d); ctx.lineTo(x + w + d, y + h - d); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.hull; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#1b2125'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
}
function plates(ctx, x, y, w, h) { ctx.strokeStyle = '#0003'; ctx.beginPath(); for (let i = 1; i < 3; i++) { ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); } ctx.stroke(); }

export function drawMobileBase(ctx, u, sel, t) {
  const P = PAL[u.team] || PAL[0], col = TEAM_COLORS[u.team];
  if (u.state === 'under') { drawTunnel(ctx, u, t); if (sel) ring(ctx, u, 30); return; }
  let sink = 0, scaleY = 1;
  if (u.state === 'burrowing') sink = Math.min(1, u.stateT / 1.1);
  else if (u.state === 'emerging') sink = 1 - Math.min(1, u.stateT / 0.8);
  
  const S = u.type === 'robot' ? 1.35 : 1.1, H = (u.type === 'robot' ? 92 : 58) * S;
  ctx.save();
  ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, u.type === 'robot' ? 40 : 28, u.type === 'robot' ? 13 : 9, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, u.type === 'robot' ? 44 : 30, u.type === 'robot' ? 15 : 11, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  if (sink > 0) { ctx.beginPath(); ctx.rect(u.x - 120, u.y - 200, 240, 204); ctx.clip(); } // sink below ground line
  const shake = u.state === 'burrowing' || u.state === 'deploying' ? Math.sin(t * 60) * 1.2 : 0;
  ctx.translate(u.x + shake, u.y + sink * H); const fk = u.faceK ?? (u.faceRight ? 1 : -1), fs = Math.sign(fk || 1) * Math.max(0.2, Math.abs(fk)); ctx.scale(fs * S, scaleY * S);
  if (!drawSketch(ctx, u, t)) { if (u.type === 'robot') drawWalker(ctx, u, P, t); else drawCrawler(ctx, u, P, t); }
  ctx.restore();
  if (sink > 0) { ctx.fillStyle = '#5b4330'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 46, 12, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 1, 34, 8, 0, 0, 7); ctx.fill(); }
  if (u.state === 'deploying') { const k = (t * 2) % 1; ctx.strokeStyle = col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(u.x, u.y, 30 + k * 60, 10 + k * 20, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.lineWidth = 1;
  const top = u.y - H * (1 - sink) - 8, w = u.type === 'robot' ? 64 : 40;
  const f = u.hp / u.stats.hp; ctx.fillStyle = '#0b0d0be0'; ctx.fillRect(u.x - w / 2 - 1, top - 1, w + 2, 5); ctx.fillStyle = f > .5 ? '#3fd84a' : f > .25 ? '#d8c03f' : '#e0443a'; ctx.fillRect(u.x - w / 2, top, w * f, 3);
  if (sel) ring(ctx, u, u.type === 'robot' ? 48 : 32);
}
function ring(ctx, u, r) { ctx.strokeStyle = '#c8e04a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, r, r * 0.34, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }

// Packed yard: low tracked crawler, folded crane on the deck, radar dish, team stripe.
function drawCrawler(ctx, u, P, t) {
  const tr = (u.walkPh * 6) % 6;
  ctx.fillStyle = '#23292d'; ctx.fillRect(-26, -12, 52, 13); ctx.fillStyle = '#3a4248';
  for (let x = -26 + tr; x < 26; x += 6) ctx.fillRect(x, -12, 3, 13);
  ctx.fillStyle = '#111'; for (let x = -20; x <= 20; x += 10) { ctx.beginPath(); ctx.arc(x, -5, 3.2, 0, 7); ctx.fill(); }
  box(ctx, -24, -28, 46, 16, P, 7); plates(ctx, -24, -28, 46, 16);
  ctx.fillStyle = P.trim; ctx.fillRect(-24, -17, 46, 3);
  box(ctx, 8, -38, 14, 10, P, 4); ctx.fillStyle = P.glass; ctx.fillRect(10, -35, 10, 3); // cab
  ctx.strokeStyle = '#d9b43a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -32); ctx.lineTo(6, -37); ctx.stroke(); // folded crane boom
  ctx.lineWidth = 1; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(-18, -32); ctx.lineTo(-18, -38); ctx.stroke();
  ctx.fillStyle = P.light; ctx.beginPath(); ctx.ellipse(-12, -40, 6, 3, -0.5 + Math.sin(t) * 0.3, 0, 7); ctx.fill(); // dish
  ctx.fillStyle = Math.sin(t * 6) > 0 ? '#f44' : '#611'; ctx.fillRect(20, -41, 2, 2);
}

// Base Walker (approved concept): yard torso with crane, barracks arm, war-factory cannon arm, power-plant cooling towers on its back.
function drawWalker(ctx, u, P, t) {
  const ph = u.walkPh, moving = u.order && u.state === 'ready', stomp = u.stomp > 0 ? 1 : 0;
  const crouch = u.state === 'deploying' ? Math.min(1, u.stateT / 1.5) * 14 : 0, bob = moving ? Math.abs(Math.sin(ph)) * 3 : 0;
  const hip = -38 + crouch;
  // legs (back leg first): thigh, shin, big foot block; feet alternate forward and lift
  for (const side of [-1, 1]) {
    const s = Math.sin(ph + (side > 0 ? Math.PI : 0)), fx = side * 9 + (moving ? s * 9 : 0), lift = moving ? Math.max(0, -s) * 7 : 0;
    const kx = side * 12 + (moving ? s * 4 : 0) + 6, ky = hip + 18 - lift * 0.5;
    ctx.strokeStyle = side < 0 ? P.dark : '#5d676e'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(side * 8, hip); ctx.lineTo(kx, ky); ctx.lineTo(fx, -6 - lift); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#333b40'; ctx.beginPath(); ctx.arc(kx, ky, 4.5, 0, 7); ctx.fill();
    box(ctx, fx - 9, -9 - lift, 18, 8, P, 3);
  }
  ctx.translate(0, -bob);
  const ty = hip - 34; // torso top
  // cooling towers on the back (carried power plant) with smoke; dim = offline while carried
  if (u.has('power')) for (const [x, h] of [[-26, 30], [-15, 26]]) {
    ctx.fillStyle = '#6b7a52'; ctx.fillRect(x - 5, ty - h + 10, 10, h); ctx.fillStyle = '#c6d84a'; ctx.globalAlpha = 0.55; ctx.fillRect(x - 5, ty - h + 14, 10, 5); ctx.globalAlpha = 1;
    ctx.fillStyle = '#8f9a6e'; ctx.beginPath(); ctx.ellipse(x, ty - h + 10, 5, 2, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 3; i++) { const k = (((t * 0.6 + i / 3 + x / 7) % 1) + 1) % 1; ctx.fillStyle = `rgba(120,120,120,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(x - k * 10, ty - h + 4 - k * 26, 3 + k * 7, 0, 7); ctx.fill(); }
  }
  // barracks arm (back shoulder): hanging building with a lit door and troopers inside
  const swing = moving ? Math.sin(ph) * 4 : 0;
  if (u.has('barracks')) {
    ctx.strokeStyle = '#3a4248'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-14, ty + 10); ctx.lineTo(-30, ty + 18 + swing); ctx.stroke(); ctx.lineWidth = 1;
    box(ctx, -52, ty + 12 + swing, 26, 22, P, 6); plates(ctx, -52, ty + 12 + swing, 26, 22);
    ctx.fillStyle = '#ffd36a'; ctx.fillRect(-47, ty + 20 + swing, 10, 12); ctx.fillStyle = '#222'; for (let i = 0; i < 3; i++) ctx.fillRect(-46 + i * 3, ty + 24 + swing, 2, 8);
    ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(-50, ty + 12 + swing); ctx.lineTo(-50, ty - 2 + swing); ctx.stroke(); ctx.fillStyle = '#e8c33a'; ctx.fillRect(-50, ty - 2 + swing, 8, 5);
    if (u.mode === 'drill') drill(ctx, -54, ty + 26 + swing, -1, t);
  } else { box(ctx, -30, ty + 14, 12, 10, P, 3); if (u.mode === 'drill') drill(ctx, -30, ty + 20, -1, t); }
  // torso: the Construction Yard itself
  box(ctx, -20, ty, 40, 34, P, 9); plates(ctx, -20, ty, 40, 34);
  ctx.fillStyle = P.trim; ctx.fillRect(-20, ty + 22, 40, 3);
  ctx.fillStyle = P.glass; for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i * 9, ty + 7, 6, 4);
  // crane on top
  const ca = -1.0 + Math.sin(t * 0.7) * 0.25; ctx.strokeStyle = '#d9b43a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-6, ty - 6); ctx.lineTo(-6 + Math.cos(ca) * 34, ty - 6 + Math.sin(ca) * 34); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = '#222'; const cx2 = -6 + Math.cos(ca) * 34, cy2 = ty - 6 + Math.sin(ca) * 34;
  ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2, cy2 + 10 + Math.sin(t * 2) * 2); ctx.stroke();
  ctx.fillStyle = Math.sin(t * 5) > 0 ? '#f44' : '#611'; ctx.fillRect(cx2 - 1, cy2 - 2, 3, 3);
  // shoulder Tiberium sprayer (front shoulder)
  ctx.fillStyle = '#3a4248'; ctx.fillRect(2, ty - 10, 10, 8); ctx.fillStyle = u.mode === 'spray' ? '#7dff4a' : '#3d6b2a';
  ctx.beginPath(); ctx.arc(7, ty - 8, 3, 0, 7); ctx.fill();
  if (u.spraying > 0) { ctx.save(); ctx.shadowColor = '#7dff4a'; ctx.shadowBlur = 12; ctx.fillStyle = '#c8ff6a'; ctx.beginPath(); ctx.arc(9, ty - 8, 4, 0, 7); ctx.fill(); ctx.restore(); }
  // war-factory cannon arm (front): long hangar block, open bay, barrel
  if (u.has('factory')) {
    const rec = u.spraying > 0 && u.mode === 'spray' ? Math.sin(t * 40) : 0;
    ctx.strokeStyle = '#3a4248'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(16, ty + 10); ctx.lineTo(24, ty + 16 - swing); ctx.stroke(); ctx.lineWidth = 1;
    box(ctx, 18, ty + 8 - swing, 40, 18, P, 6); plates(ctx, 18, ty + 8 - swing, 40, 18);
    ctx.fillStyle = '#2a2f33'; ctx.fillRect(48, ty + 11 - swing, 8, 12); ctx.fillStyle = '#e8c33a'; ctx.fillRect(47, ty + 10 - swing, 2, 14);
    ctx.fillStyle = '#555f66'; ctx.fillRect(56 + rec, ty + 14 - swing, 12, 5);
    if (u.mode === 'drill') drill(ctx, 66, ty + 17 - swing, 1, t);
  } else { box(ctx, 18, ty + 12, 14, 10, P, 3); if (u.mode === 'drill') drill(ctx, 32, ty + 17, 1, t); }
  // team flag
  ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(14, ty - 9); ctx.lineTo(14, ty - 24); ctx.stroke(); ctx.fillStyle = P.trim; ctx.fillRect(14, ty - 24, 9, 6);
}
function drill(ctx, x, y, dir, t) {
  ctx.fillStyle = '#c9c9c9'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + dir * 16, y); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#666'; ctx.beginPath(); for (let i = 0; i < 3; i++) { const k = ((t * 6 + i / 3) % 1); ctx.moveTo(x + dir * k * 14, y - 6 * (1 - k)); ctx.lineTo(x + dir * (k * 14 + 3), y + 6 * (1 - k)); } ctx.stroke();
}
// Underground: moving mound of churned dirt + cracks (own team sees an outline marker).
function drawTunnel(ctx, u, t) {
  ctx.fillStyle = '#5b4330'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 22 + Math.sin(t * 12) * 2, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a5a3a'; for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.3; ctx.beginPath(); ctx.arc(u.x + Math.cos(a) * 14, u.y + Math.sin(a) * 5 - 3, 3, 0, 7); ctx.fill(); }
  if (u.team === 0) { ctx.strokeStyle = '#3fa9ff'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(u.x, u.y, 30, 11, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
}

// v9 painted Base Walker: layers cut from the approved painted preview (assets/pw_*.png), all on one 442x382 canvas so they
// stay aligned. Towers / barracks arm / cannon arm are only drawn if that building is carried. Keyframed gait: each leg
// swings (lifted, rotating about its hip) then plants; body bobs and sways with the steps. Legs unfold on rise, fold on deploy.
const IW = 442, GX = 221, GY = 372, WALKER_W = 96, CRAWLER_W = 56;
const HIP = { L: [160, 240], R: [285, 240] };
const eo = k => 1 - (1 - k) * (1 - k);
function layer(ctx, name, team, s, dx = 0, dy = 0, rot = 0, pivot = null, sy = 1) {
  const sp = getSprite(name, team); if (!sp) return false; const w = IW * s, h = w * sp.aspect;
  ctx.save(); ctx.translate(dx, dy);
  if (pivot) { const px = (pivot[0] - GX) * s, py = (pivot[1] - GY) * s; ctx.translate(px, py); ctx.rotate(rot); ctx.scale(1, sy); ctx.translate(-px, -py); }
  ctx.drawImage(sp.img, -GX * s, -GY * s, w, h); ctx.restore(); return true;
}
function drawSketch(ctx, u, t) {
  const s = (u.type === 'robot' ? WALKER_W : CRAWLER_W) / IW;
  if (!getSprite('pw_body', u.team) || !getSprite('pw_legL', u.team)) return false;
  // pose: rise (legs unfold, body lifts) / crouch on deploy / walk cycle
  let unfold = 1;
  if (u.state === 'rising') unfold = eo(Math.min(1, u.stateT / (u.type === 'robot' ? 1.1 : 0.6)));
  else if (u.state === 'deploying') unfold = 1 - eo(Math.min(1, u.stateT / (u.type === 'robot' ? 1.3 : 0.8)));
  if (u.type !== 'robot') { // crawler: armored tracks + the yard body riding low
    const jig = u.order ? Math.sin(u.walkPh * 3) * 0.6 : 0, tr = (u.walkPh * 6) % 6;
    ctx.fillStyle = '#26241f'; ctx.fillRect(-27, -12, 54, 13); ctx.fillStyle = '#4a463c'; for (let x = -27 + tr; x < 27; x += 6) ctx.fillRect(x, -12, 3, 13);
    ctx.fillStyle = '#5e5a4e'; for (let x = -20; x <= 20; x += 10) { ctx.beginPath(); ctx.arc(x, -5, 3.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-27, -14, 54, 2.5);
    layer(ctx, 'pw_body', u.team, s, 2, -10 + jig + (1 - unfold) * 8, 0, null, 0.55 + 0.45 * unfold);
    teamFlag(ctx, u, -20, -40); return true;
  }
  const amp = Math.min(1, (u.vel || 0) / (u.stats.speed * 0.6)), ph = u.walkPh;
  const leg = side => { const p = side === 'L' ? ph : ph + Math.PI, sw = Math.sin(p);
    return { lift: Math.pow(Math.max(0, sw), 1.4) * 7 * amp, dx: Math.cos(p) * 4 * amp, rot: -Math.cos(p) * 0.12 * amp }; };
  const L = leg('L'), R = leg('R');
  const bob = (Math.abs(Math.sin(ph)) * 2.6 * amp) + (1 - unfold) * -26 + (u.stomp > 0 ? -1 : 0), sway = Math.sin(ph) * 0.03 * amp;
  const legSy = 0.25 + 0.75 * unfold;
  ctx.save(); ctx.rotate(sway);
  if (u.has('power')) layer(ctx, 'pw_towers', u.team, s, 0, -bob + (1 - unfold) * 6);
  layer(ctx, 'pw_legR', u.team, s, R.dx, -R.lift, R.rot, HIP.R, legSy);
  layer(ctx, 'pw_legL', u.team, s, L.dx, -L.lift, L.rot, HIP.L, legSy);
  layer(ctx, 'pw_body', u.team, s, 0, -bob);
  if (u.has('barracks')) layer(ctx, 'pw_armL', u.team, s, 0, -bob, Math.sin(ph) * 0.05 * amp, [100, 140]);
  if (u.has('factory')) layer(ctx, 'pw_armR', u.team, s, 0, -bob, (u.spraying > 0 ? Math.sin(t * 40) * 0.01 : 0) - Math.sin(ph) * 0.04 * amp, [285, 110]);
  const tip = [(430 - GX) * s, (205 - GY) * s - bob];
  if (u.mode === 'drill') inkDrill(ctx, tip[0], tip[1], t);
  if (u.spraying > 0) { ctx.save(); ctx.shadowColor = '#7dff4a'; ctx.shadowBlur = 12; ctx.fillStyle = '#c8ff6a'; ctx.beginPath(); ctx.arc((300 - GX) * s, (100 - GY) * s - bob, 3.5, 0, 7); ctx.fill(); ctx.restore(); }
  teamFlag(ctx, u, -10, (20 - GY) * s - bob);
  ctx.restore(); return true;
}
function teamFlag(ctx, u, x, y) { ctx.fillStyle = TEAM_COLORS[u.team]; ctx.strokeStyle = '#2b261e'; ctx.lineWidth = 0.8; ctx.fillRect(x, y, 6, 4); ctx.strokeRect(x, y, 6, 4); }
function inkDrill(ctx, x, y, t) { // hatched steel drill cone with ink outline, spinning hatch lines
  ctx.fillStyle = '#b9b3a2'; ctx.strokeStyle = '#2b261e'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 1, y - 5); ctx.lineTo(x + 14, y); ctx.lineTo(x - 1, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = 0; i < 3; i++) { const k = (t * 6 + i / 3) % 1; ctx.moveTo(x + k * 12, y - 5 * (1 - k)); ctx.lineTo(x + k * 12 + 2, y + 5 * (1 - k)); } ctx.stroke();
}
