// v9 painted-style art drawn in code: staged transform sequence, walls/gates/turret, four infantry types, tiberium clusters.
import { TILE, TEAM_COLORS } from '../data/stats.js';
import { drawBuildingArt } from './buildingArt.js';
import { getSprite } from './sprites.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = k => 1 - (1 - k) * (1 - k);
const easeInOut = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const backOut = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const SEL = '#c8e04a';

// ---- staged transform: one building's pose at progress P (0..0.78). Used forward (pack) and backward (deploy unfold).
export function drawMorphing(ctx, b, t, g) {
  const m = b.morph || b.unfold, P = m.P ?? 0, i = m.i || 0, robot = m.mode === 'transform';
  const lift = easeOut(clamp(P / 0.2)) * 10;                                   // 1) hydraulic jacks
  const f = easeInOut(clamp((P - 0.2 - i * 0.06) / 0.22));                     // 2) fold, staggered per building
  const c = clamp((P - 0.5 - i * 0.04) / 0.24), cb = c > 0 ? backOut(c) : 0;   // 3) arc flight with overshoot
  const sx = b.x, sy = b.y, ax = m.ax, ay = m.ay;
  const cx = (sx + ax) / 2 + (robot ? (i % 2 ? 30 : -30) : 0), cy = Math.min(sy, ay) - (robot ? 70 : 20);
  const qx = (1 - cb) * (1 - cb) * sx + 2 * (1 - cb) * cb * cx + cb * cb * ax, qy = (1 - cb) * (1 - cb) * sy + 2 * (1 - cb) * cb * cy + cb * cb * ay;
  const px = c > 0 ? qx : sx, py = (c > 0 ? qy : sy) - lift * (1 - cb);
  let scx = 1, scy = 1, rot = 0;
  if (b.type === 'barracks') { rot = f * (robot ? -1.1 : 0); scx = scy = 1 - 0.4 * f; }        // rotates + folds into an arm
  else if (b.type === 'factory') { scy = 1 - 0.55 * f; scx = 1 - 0.25 * f; }                   // hangar collapses
  else if (b.type === 'power') { scy = 1 - 0.45 * f; scx = 1 - 0.3 * f; rot = f * 0.5; }     // towers retract, swing onto the back
  else { scx = scy = 1 - 0.25 * f; }                                                         // yard: crane folds
  const shrink = 1 - 0.35 * cb;
  // jacks + warning lights under the lifted building
  if (lift > 1 && c < 0.2) {
    ctx.strokeStyle = '#3b3a34'; ctx.lineWidth = 3;
    for (const k of [-0.35, 0.35]) { ctx.beginPath(); ctx.moveTo(sx + k * b.w * TILE, sy + b.h * TILE / 2); ctx.lineTo(sx + k * b.w * TILE, sy + b.h * TILE / 2 - lift); ctx.stroke(); }
    ctx.lineWidth = 1;
  }
  ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(scx * shrink, scy * shrink); ctx.translate(-b.x, -b.y);
  drawBuildingArt(ctx, b, t, g); ctx.restore();
  if (P < 0.5) for (const k of [-1, 1]) { const on = Math.sin(t * 14 + k) > 0; ctx.fillStyle = on ? '#ffb020' : '#5a3a10'; ctx.shadowColor = '#ffb020'; ctx.shadowBlur = on ? 10 : 0;
    ctx.beginPath(); ctx.arc(px + k * b.w * TILE * 0.42 * scx, py - b.h * TILE * 0.45 * scy, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  if (b.type === 'factory' && f > 0.3) { ctx.strokeStyle = '#4a4a42'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px + 6, py - 4); ctx.lineTo(px + 6 + 22 * f, py - 4 - 6 * f); ctx.stroke(); ctx.lineWidth = 1; } // barrel extends
}

// ---- walls: riveted armored slabs, yellow hazard stripes, green conduits; auto-connect to neighbouring walls/gates
function link(g, b, dx, dy) { return !!(g && g.wallAt(b.team, b.tx + dx, b.ty + dy)); }
function slab(ctx, x, y, w, h, dmg, t, glow) {
  ctx.fillStyle = '#0006'; ctx.fillRect(x + 3, y + 4, w, h);
  const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#77756a'); gr.addColorStop(1, '#4a4940'); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8e8b7d'; ctx.fillRect(x, y, w, 3); // lit top edge
  ctx.save(); ctx.beginPath(); ctx.rect(x, y + h - 6, w, 5); ctx.clip(); ctx.fillStyle = '#c9a227'; ctx.fillRect(x, y + h - 6, w, 5); ctx.fillStyle = '#1e1d1a';
  for (let k = -10; k < w + 10; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + 4, y + h); ctx.lineTo(x + k + 9, y + h - 6); ctx.lineTo(x + k + 5, y + h - 6); ctx.fill(); } ctx.restore();
  ctx.fillStyle = '#2b2a25'; for (let k = 4; k < w - 2; k += 7) { ctx.fillRect(x + k, y + 5, 1.6, 1.6); }
  if (glow) { ctx.fillStyle = `rgba(110,255,90,${0.55 + 0.25 * Math.sin(t * 3)})`; ctx.shadowColor = '#6f4'; ctx.shadowBlur = 6; ctx.fillRect(x + 2, y + h * 0.42, w - 4, 2.5); ctx.shadowBlur = 0; }
  if (dmg > 0.33) { ctx.strokeStyle = '#1b1a16'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + 3); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.35, y + h - 6); ctx.stroke(); ctx.lineWidth = 1; }
  if (dmg > 0.66) { ctx.fillStyle = '#2a2620'; ctx.beginPath(); ctx.moveTo(x + w * 0.6, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.45); ctx.closePath(); ctx.fill(); }
}
export function drawWall(ctx, b, t, g) {
  const X = b.tx * TILE, Y = b.ty * TILE, dmg = 1 - b.hp / b.stats.hp, H = 22, top = Y + TILE - H - 2;
  const n = link(g, b, 0, -1), s = link(g, b, 0, 1), e = link(g, b, 1, 0), w = link(g, b, -1, 0);
  if (n) slab(ctx, X + 9, Y - 4, 14, TILE - H + 6, dmg, t, false);
  const l = w ? X : X + 6, r = e ? X + TILE : X + TILE - 6; slab(ctx, l, top, r - l, H, dmg, t, e || w);
  if (s && !e && !w) slab(ctx, X + 9, top + H - 4, 14, 8, dmg, t, false);
  // post at junctions / ends
  if ((n || s) && (e || w) || (!e && !w)) { ctx.fillStyle = '#5c5a50'; ctx.fillRect(X + 10, top - 4, 12, H + 4); ctx.fillStyle = '#9a9686'; ctx.fillRect(X + 10, top - 4, 12, 3);
    ctx.fillStyle = TEAM_COLORS[b.team]; ctx.fillRect(X + 14, top + 2, 4, 3); }
}
// ---- gate: hydraulic blast doors in a wall line; doors slide apart by openK; red/green status light, padlock when locked
export function drawGate(ctx, b, t, g) {
  const X = b.tx * TILE, Y = b.ty * TILE, k = b.openK || 0, H = 26, top = Y + TILE - H - 2, dmg = 1 - b.hp / b.stats.hp;
  ctx.fillStyle = '#0006'; ctx.fillRect(X + 2, top + 4, TILE, H);
  ctx.fillStyle = '#3a3933'; ctx.fillRect(X, top - 4, 5, H + 4); ctx.fillRect(X + TILE - 5, top - 4, 5, H + 4); // frame pillars
  ctx.fillStyle = '#c9a227'; ctx.fillRect(X, top - 6, TILE, 4); ctx.fillStyle = '#1e1d1a'; for (let i = 0; i < TILE; i += 6) ctx.fillRect(X + i, top - 6, 3, 4);
  const dw = (TILE - 10) / 2 * (1 - k * 0.92);
  for (const [dx, side] of [[X + 5, 1], [X + TILE - 5 - dw, -1]]) {
    const gr = ctx.createLinearGradient(dx, top, dx + dw, top); gr.addColorStop(0, '#6c6a5e'); gr.addColorStop(1, '#4b4a42'); ctx.fillStyle = gr; ctx.fillRect(dx, top, dw, H);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(dx, top + H - 7, dw, 4);
    ctx.fillStyle = `rgba(110,255,90,${0.5 + 0.3 * Math.sin(t * 4)})`; ctx.fillRect(side > 0 ? dx + 2 : dx + dw - 4, top + 4, 2, H - 12); // tiberium piston
  }
  const on = b.locked ? '#f43' : k > 0.5 ? '#5f5' : '#fb3'; ctx.fillStyle = on; ctx.shadowColor = on; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(X + TILE / 2, top - 9, 2.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  if (b.locked) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X + TILE / 2, top + 9, 3, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#ddd'; ctx.fillRect(X + TILE / 2 - 4, top + 9, 8, 6); ctx.lineWidth = 1; }
  if (dmg > 0.5) { ctx.strokeStyle = '#1b1a16'; ctx.beginPath(); ctx.moveTo(X + 8, top + 3); ctx.lineTo(X + 13, top + 14); ctx.stroke(); }
}
// ---- Tiberium cannon: octagonal bunker with hazard ring, rotating twin-barrel head, glowing tiberium cells
export function drawTurret(ctx, b, t, g) {
  const cx = b.x, cy = b.y + 6, powered = b.powered !== false, dmg = 1 - b.hp / b.stats.hp;
  ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 6, 19, 9, 0, 0, 7); ctx.fill();
  const oct = (r, ry) => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * 6.283; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * ry); } ctx.closePath(); };
  oct(18, 10); ctx.fillStyle = '#4a4940'; ctx.fill(); ctx.save(); oct(18, 10); ctx.clip(); ctx.fillStyle = '#c9a227'; ctx.fillRect(cx - 20, cy + 3, 40, 4);
  ctx.fillStyle = '#1e1d1a'; for (let k = -20; k < 20; k += 6) ctx.fillRect(cx + k, cy + 3, 3, 4); ctx.restore();
  oct(14, 7.5); ctx.fillStyle = '#6a685c'; ctx.save(); ctx.translate(0, -4); ctx.fill(); ctx.restore();
  // head
  const a = b.aim ?? 1.57, hx = cx, hy = cy - 8;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
  ctx.fillStyle = '#2f2e29'; for (const o of [-3.5, 3.5]) ctx.fillRect(4, o - 1.8, 18, 3.6);
  ctx.fillStyle = '#55534a'; ctx.fillRect(-8, -8, 14, 16); ctx.fillStyle = '#7a776a'; ctx.fillRect(-8, -8, 14, 3);
  ctx.fillStyle = powered ? `rgba(110,255,90,${0.7 + 0.3 * Math.sin(t * 5)})` : '#2a3a22'; if (powered) { ctx.shadowColor = '#6f4'; ctx.shadowBlur = 8; }
  ctx.fillRect(-6, -6, 4, 4); ctx.fillRect(-6, 2, 4, 4); ctx.shadowBlur = 0;
  if (b.flash > 0) { ctx.fillStyle = '#d8ff9a'; ctx.shadowColor = '#9f4'; ctx.shadowBlur = 14; for (const o of [-3.5, 3.5]) { ctx.beginPath(); ctx.arc(24, o, 3.5, 0, 7); ctx.fill(); } ctx.shadowBlur = 0; }
  ctx.restore();
  if (dmg > 0.5) { ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 2 + Math.sin(t * 15), 0, 7); ctx.fill(); }
}

// ---- infantry: four clearly different silhouettes (painted shading). Rifleman uses the sprite if loaded.
export function drawTrooper(ctx, u, t, H, moving, ph) {
  const type = u.type, st = moving ? Math.sin(ph) * 3 : 0, tm = TEAM_COLORS[u.team];
  const skin = '#c9a07a', dark = '#262a24';
  const legs = (col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-2 + st, 0); ctx.moveTo(0, -9); ctx.lineTo(2 - st, 0); ctx.stroke(); };
  const torso = (col, w, h, y = -18) => { const gr = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, col); gr.addColorStop(1, shade(col)); ctx.fillStyle = gr; ctx.fillRect(-w / 2, y, w, h); };
  if (type === 'sniper') { // ghillie hood, long rifle, slim
    legs('#3a4430'); torso('#5d6b3e', 6, 10); ctx.fillStyle = '#4e5c34'; ctx.beginPath(); ctx.arc(0, -21, 3.6, 0, 7); ctx.fill(); // hood
    ctx.fillStyle = '#6f7d48'; for (let k = 0; k < 5; k++) ctx.fillRect(-4 + k * 1.8, -17 + (k % 2) * 3, 1.4, 4); // ghillie strips
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3, -15); ctx.lineTo(14, -14); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(4, -16.5, 4, 1.6); // scope
    ctx.fillStyle = tm; ctx.fillRect(-3, -12, 6, 1.5);
  } else if (type === 'rocket') { // bulky armor, launcher tube on the shoulder
    legs('#3b3a33'); torso('#6b6450', 9, 11, -19); ctx.fillStyle = '#4a463a'; ctx.beginPath(); ctx.arc(0, -22, 3.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#9ff'; ctx.fillRect(0.5, -23, 3, 1.4);
    ctx.fillStyle = '#3c4a2c'; ctx.save(); ctx.rotate(-0.12); ctx.fillRect(-9, -26, 20, 5); ctx.fillStyle = '#222'; ctx.fillRect(10, -26, 2, 5); ctx.fillStyle = '#c9a227'; ctx.fillRect(-9, -26, 3, 5); ctx.restore();
    ctx.fillStyle = tm; ctx.fillRect(-4.5, -13, 9, 1.8);
    if (u.dug) { ctx.fillStyle = '#8a7350'; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 3 - 1, 4, 2.3, 0, 0, 7); ctx.fill(); } }
  } else if (type === 'engineer') { // hard hat, hi-vis vest, toolbox + wrench, no gun
    legs('#3a3f45'); torso('#d97a1e', 7, 10); ctx.fillStyle = '#e8e2c8'; ctx.fillRect(-3.5, -15, 7, 1.5); ctx.fillRect(-3.5, -11.5, 7, 1.5); // reflective stripes
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -21, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(0, -22, 3.8, Math.PI, 0); ctx.fill(); ctx.fillRect(-4.6, -22.3, 9.2, 1.4);
    ctx.fillStyle = '#b8352a'; ctx.fillRect(4, -10, 5, 4); ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-8, -8); ctx.stroke();
    ctx.fillStyle = tm; ctx.fillRect(-3.5, -18, 7, 1.5);
  } else { // rifleman fallback (normally the sprite)
    legs('#2a333c'); torso(tm, 7, 10); ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(0, -21, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#9ff'; ctx.fillRect(0.5, -22, 2.5, 1.2); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(9, -11); ctx.stroke();
  }
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;
}
function shade(hex) { const n = parseInt(hex.slice(1, 7), 16), r = (n >> 16) * 0.65 | 0, g = (n >> 8 & 255) * 0.65 | 0, b = (n & 255) * 0.65 | 0; return `rgb(${r},${g},${b})`; }
export const MUZZLE = { infantry: [10, -11], sniper: [15, -14], rocket: [12, -24], engineer: [0, -12] };

// ---- tiberium: glowing green crystal clusters with a darker base, highlight facets and a soft glow
export function drawCrystalCluster(ctx, tx, ty, f, t) {
  const cx = tx * TILE, cy = ty * TILE, n = 2 + Math.round(f * 3);
  ctx.save(); ctx.shadowColor = '#4f3'; ctx.shadowBlur = 7 + Math.sin(t * 2 + tx * 1.3 + ty) * 3;
  for (let k = 0; k < n; k++) {
    const ox = cx + 5 + ((k * 37 + tx * 13) % 22), oy = cy + 10 + ((k * 23 + ty * 7) % 18), h = 7 + f * 11 + (k % 3) * 2, w = 3 + (k % 2) * 1.5, lean = ((k * 7 + tx) % 5 - 2) * 0.8;
    ctx.fillStyle = '#1f7a1c'; ctx.beginPath(); ctx.moveTo(ox + lean, oy - h); ctx.lineTo(ox + w, oy); ctx.lineTo(ox - w, oy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = k % 2 ? '#5df04a' : '#3fd23a'; ctx.beginPath(); ctx.moveTo(ox + lean, oy - h); ctx.lineTo(ox + w * 0.2, oy); ctx.lineTo(ox - w, oy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(220,255,200,0.55)'; ctx.beginPath(); ctx.moveTo(ox + lean, oy - h); ctx.lineTo(ox - w * 0.2, oy - h * 0.4); ctx.lineTo(ox - w * 0.6, oy - h * 0.3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
