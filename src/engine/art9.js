import { ME } from './local.js?v=10.0';
// v9 painted-style art drawn in code: staged transform sequence, walls/gates/turret, four infantry types, tiberium clusters.
import { TILE, TEAM_COLORS } from '../data/stats.js?v=10.0';
import { drawBuildingArt } from './buildingArt.js?v=10.0';
import { getSprite } from './sprites.js?v=10.0';

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
  const c = clamp((P - 0.5 - i * 0.04) / 0.24), cb = c > 0 ? easeInOut(c) : 0;   // 3) arc flight, eased in-out (v10.0: no overshoot)
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
// v10.1 per-faction wall materials: human concrete + hazard stripe, reptile hide over bone ribs, nordic white ashlar + gold band, grey brushed silver + purple seam
const WALLP = { human: { a: '#77756a', b: '#4a4940', lit: '#8e8b7d', band: '#c9a227', dark: '#1e1d1a', glow: 'rgba(110,255,90,', gc: '#6f4' },
  reptile: { a: '#8f7d4c', b: '#4d4426', lit: '#e3d6aa', band: '#d9cb9c', dark: '#3a2e18', glow: 'rgba(150,255,80,', gc: '#9f4' },
  nordic: { a: '#fbf8ef', b: '#cfc5ad', lit: '#ffffff', band: '#d9b04a', dark: '#b39548', glow: 'rgba(255,240,180,', gc: '#fe9' },
  grey: { a: '#d5d9e0', b: '#737884', lit: '#f6f8fb', band: '#8b5bdc', dark: '#4a4e58', glow: 'rgba(185,120,255,', gc: '#b7f' } };
let WF = 'human';
const facOf = (g, b) => (g && g.teams && g.teams[b.team] && g.teams[b.team].faction) || 'human';
function slab(ctx, x, y, w, h, dmg, t, glow) { if (WF !== 'human') return slabF(ctx, x, y, w, h, dmg, t, glow, WALLP[WF]);
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
function slabF(ctx, x, y, w, h, dmg, t, glow, P) {
  ctx.fillStyle = '#0005'; ctx.fillRect(x + 3, y + 4, w, h);
  if (WF === 'reptile') { // stretched hide between bone ribs, tusk tips along the top
    ctx.fillStyle = lg9(ctx, x, y, x, y + h, [P.a, P.b]); ctx.beginPath(); ctx.moveTo(x, y + 3); for (let k = 0; k <= w; k += 8) ctx.quadraticCurveTo(x + k - 4, y + 7, x + k, y + 3); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,45,20,0.45)'; for (let k = 3; k < w; k += 5) { ctx.beginPath(); ctx.arc(x + k, y + h * 0.55 + (k % 2) * 3, 2.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.fillStyle = P.band; for (let k = 0; k <= w; k += 8) { ctx.fillRect(x + k - 1.5, y + 2, 3, h - 2); ctx.beginPath(); ctx.moveTo(x + k - 2, y + 3); ctx.lineTo(x + k + 1, y - 5); ctx.lineTo(x + k + 2, y + 3); ctx.fill(); } }
  else if (WF === 'nordic') { // dressed white ashlar blocks with a gold band
    ctx.fillStyle = lg9(ctx, x, y, x, y + h, [P.a, P.b]); ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(140,125,90,0.45)'; ctx.lineWidth = 0.8;
    for (let r = 0; r < 3; r++) { const yy = y + 3 + r * (h - 3) / 3; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let k = (r % 2) * 5; k < w; k += 10) { ctx.beginPath(); ctx.moveTo(x + k, yy); ctx.lineTo(x + k, yy + (h - 3) / 3); ctx.stroke(); } }
    ctx.lineWidth = 1; ctx.fillStyle = P.lit; ctx.fillRect(x, y, w, 3); ctx.fillStyle = P.band; ctx.fillRect(x, y + 3, w, 2); ctx.fillRect(x, y + h - 4, w, 1.5); }
  else { // grey: one seamless brushed-silver extrusion with rounded top and a purple light seam
    ctx.fillStyle = lg9(ctx, x, y, x, y + h, [P.lit, P.a, P.b]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, [6, 6, 2, 2]) : ctx.rect(x, y, w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(x + 3, y + 2.5); ctx.lineTo(x + w - 3, y + 2.5); ctx.stroke();
    ctx.fillStyle = `rgba(185,120,255,${0.6 + 0.3 * Math.sin(t * 3)})`; ctx.fillRect(x + 1, y + h * 0.6, w - 2, 1.8); }
  if (glow) { ctx.fillStyle = `${P.glow}${0.45 + 0.25 * Math.sin(t * 3)})`; ctx.shadowColor = P.gc; ctx.shadowBlur = 5; ctx.fillRect(x + 2, y + h * 0.42, w - 4, 1.6); ctx.shadowBlur = 0; }
  if (dmg > 0.33) { ctx.strokeStyle = 'rgba(30,26,18,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + 3); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.35, y + h - 6); ctx.stroke(); ctx.lineWidth = 1; }
}
const lg9 = (ctx, x0, y0, x1, y1, st) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach((c, i) => gr.addColorStop(i / Math.max(1, st.length - 1), c)); return gr; };
function postF(ctx, X, top, H, team, t) { const P = WALLP[WF];
  if (WF === 'reptile') { ctx.fillStyle = P.band; ctx.beginPath(); ctx.moveTo(X + 11, top + H); ctx.quadraticCurveTo(X + 10, top - 4, X + 17, top - 10); ctx.quadraticCurveTo(X + 16, top, X + 21, top + H); ctx.fill(); ctx.strokeStyle = '#7a6a44'; ctx.stroke(); }
  else if (WF === 'nordic') { ctx.fillStyle = lg9(ctx, X + 10, 0, X + 22, 0, ['#e3dac4', '#fffdf6', '#bdb29a']); ctx.beginPath(); ctx.moveTo(X + 11, top + H); ctx.lineTo(X + 12, top - 2); ctx.lineTo(X + 16, top - 10); ctx.lineTo(X + 20, top - 2); ctx.lineTo(X + 21, top + H); ctx.fill(); ctx.fillStyle = P.band; ctx.beginPath(); ctx.moveTo(X + 12, top - 2); ctx.lineTo(X + 16, top - 11); ctx.lineTo(X + 20, top - 2); ctx.fill(); }
  else { ctx.fillStyle = lg9(ctx, X + 10, 0, X + 22, 0, ['#9aa0ab', '#f4f6fa', '#646975']); ctx.fillRect(X + 12, top - 2, 8, H + 2); const g = ctx.createRadialGradient(X + 15, top - 6, 0, X + 16, top - 5, 7); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#c9a6ff'); g.addColorStop(1, 'rgba(140,80,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + 16, top - 5, 7, 0, 7); ctx.fill(); }
  ctx.fillStyle = TEAM_COLORS[team]; ctx.fillRect(X + 14, top + H - 6, 4, 3); }
export function drawWall(ctx, b, t, g) { WF = facOf(g, b); if (WF !== 'human') { drawWallF(ctx, b, t, g); WF = 'human'; return; }
  const X = b.tx * TILE, Y = b.ty * TILE, dmg = 1 - b.hp / b.stats.hp, H = 22, top = Y + TILE - H - 2;
  const n = link(g, b, 0, -1), s = link(g, b, 0, 1), e = link(g, b, 1, 0), w = link(g, b, -1, 0);
  if (n) slab(ctx, X + 9, Y - 4, 14, TILE - H + 6, dmg, t, false);
  const l = w ? X : X + 6, r = e ? X + TILE : X + TILE - 6; slab(ctx, l, top, r - l, H, dmg, t, e || w);
  if (s && !e && !w) slab(ctx, X + 9, top + H - 4, 14, 8, dmg, t, false);
  // post at junctions / ends
  if ((n || s) && (e || w) || (!e && !w)) { ctx.fillStyle = '#5c5a50'; ctx.fillRect(X + 10, top - 4, 12, H + 4); ctx.fillStyle = '#9a9686'; ctx.fillRect(X + 10, top - 4, 12, 3);
    ctx.fillStyle = TEAM_COLORS[b.team]; ctx.fillRect(X + 14, top + 2, 4, 3); }
}
function drawWallF(ctx, b, t, g) {
  const X = b.tx * TILE, Y = b.ty * TILE, dmg = 1 - b.hp / b.stats.hp, H = 22, top = Y + TILE - H - 2;
  const n = link(g, b, 0, -1), s = link(g, b, 0, 1), e = link(g, b, 1, 0), w = link(g, b, -1, 0);
  if (n) slab(ctx, X + 9, Y - 4, 14, TILE - H + 6, dmg, t, false);
  const l = w ? X : X + 6, r = e ? X + TILE : X + TILE - 6; slab(ctx, l, top, r - l, H, dmg, t, e || w);
  if (s && !e && !w) slab(ctx, X + 9, top + H - 4, 14, 8, dmg, t, false);
  if ((n || s) && (e || w) || (!e && !w)) postF(ctx, X, top, H, b.team, t);
}
// faction gates: reptile = ribcage jaws that part, nordic = gold-framed white arch with light curtain, grey = iris of silver petals
function drawGateF(ctx, b, t, g) {
  const X = b.tx * TILE, Y = b.ty * TILE, k = b.openK || 0, H = 26, top = Y + TILE - H - 2, P = WALLP[WF], cx = X + TILE / 2;
  ctx.fillStyle = '#0005'; ctx.fillRect(X + 2, top + 4, TILE, H);
  if (WF === 'reptile') { for (const sd of [-1, 1]) { ctx.fillStyle = P.band; ctx.beginPath(); ctx.moveTo(cx + sd * 15, top + H); ctx.quadraticCurveTo(cx + sd * 17, top - 6, cx + sd * 8, top - 10); ctx.quadraticCurveTo(cx + sd * 12, top, cx + sd * 11, top + H); ctx.fill(); }
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const y = top + 2 + i * 6, len = (10 - i) * (1 - k * 0.9); ctx.strokeStyle = P.band; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + sd * 12, y); ctx.quadraticCurveTo(cx + sd * (12 - len * 0.6), y - 2, cx + sd * (12 - len), y + 2); ctx.stroke(); } ctx.lineWidth = 1; }
  else if (WF === 'nordic') { ctx.fillStyle = lg9(ctx, 0, top - 8, 0, top + H, [P.a, P.b]); ctx.fillRect(X, top - 4, 6, H + 4); ctx.fillRect(X + TILE - 6, top - 4, 6, H + 4);
    ctx.strokeStyle = P.band; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, top + 4, TILE / 2 - 3, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = `rgba(255,244,200,${(1 - k) * (0.45 + 0.2 * Math.sin(t * 4))})`; ctx.fillRect(X + 6, top + 4, TILE - 12, H - 4); }
  else { ctx.fillStyle = lg9(ctx, 0, top, 0, top + H, ['#f4f6fa', '#9aa0ab', '#555a65']); ctx.beginPath(); ctx.ellipse(cx, top + H / 2, TILE / 2, H / 2 + 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1922'; ctx.beginPath(); ctx.ellipse(cx, top + H / 2, (TILE / 2 - 4) * k, (H / 2 - 2) * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,60,72,0.7)'; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + k * 1.2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (TILE / 2 - 4) * k, top + H / 2 + Math.sin(a) * (H / 2 - 2) * k); ctx.lineTo(cx + Math.cos(a + 0.6) * (TILE / 2 - 2), top + H / 2 + Math.sin(a + 0.6) * (H / 2)); ctx.stroke(); }
    ctx.strokeStyle = `rgba(185,120,255,${0.6 + 0.3 * Math.sin(t * 3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, top + H / 2, TILE / 2 - 1, H / 2 + 1, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
  const on = b.locked ? '#f43' : k > 0.5 ? '#5f5' : '#fb3'; ctx.fillStyle = on; ctx.beginPath(); ctx.arc(cx, top - 12, 2.2, 0, 7); ctx.fill();
}
// ---- gate: hydraulic blast doors in a wall line; doors slide apart by openK; red/green status light, padlock when locked
export function drawGate(ctx, b, t, g) { WF = facOf(g, b); if (WF !== 'human') { drawGateF(ctx, b, t, g); WF = 'human'; return; }
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
  } else if (type === 'medic') { // white field kit with red cross armband, satchel, no rifle
    legs('#3a3f45'); torso('#e4e2d8', 7, 10); ctx.fillStyle = '#c42a22'; ctx.fillRect(-1, -17, 2, 6); ctx.fillRect(-3, -15, 6, 2); // red cross
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -21, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#6b7058'; ctx.beginPath(); ctx.arc(0, -22, 3.6, Math.PI, 0); ctx.fill(); // helmet
    ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -25, 3, 1); ctx.fillStyle = '#7a5a34'; ctx.fillRect(-7, -13, 4, 5); // satchel
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(8, -12); ctx.stroke(); ctx.fillStyle = '#9fe'; ctx.fillRect(7.5, -13, 2, 2); // injector
    ctx.fillStyle = tm; ctx.fillRect(-3.5, -9.5, 7, 1.5);
  } else { // rifleman fallback (normally the sprite)
    legs('#2a333c'); torso(tm, 7, 10); ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(0, -21, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#9ff'; ctx.fillRect(0.5, -22, 2.5, 1.2); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(9, -11); ctx.stroke();
  }
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;
}
function shade(hex) { const n = parseInt(hex.slice(1, 7), 16), r = (n >> 16) * 0.65 | 0, g = (n >> 8 & 255) * 0.65 | 0, b = (n & 255) * 0.65 | 0; return `rgb(${r},${g},${b})`; }
export const MUZZLE = { infantry: [10, -11], sniper: [15, -14], rocket: [12, -24], engineer: [0, -12], medic: [8, -12] };

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

// ---- v9.1 Dropship: painted tilt-rotor transport (gunmetal/olive hull, glass canopy, twin rotor nacelles, hazard-striped ramp)
export function drawDropship(ctx, u, t, viewerTeam = 0) {
  const lift = 20 + Math.sin(t * 2.2 + u.id) * 2, face = Math.cos(u.angle || 0) >= 0 ? 1 : -1, tilt = Math.max(-0.25, Math.min(0.25, (u.vx || 0) * 0.002));
  const hidden = u.cloaked && u.team !== viewerTeam && !u.detected;
  ctx.save();
  ctx.globalAlpha = hidden ? 0.07 : u.cloaked ? 0.4 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 30, 9, 0, 0, 7); ctx.fill();
  ctx.translate(u.x, u.y - lift); ctx.scale(face, 1); ctx.rotate(tilt);
  // wings + nacelles (back)
  ctx.fillStyle = '#3c3e38'; ctx.fillRect(-6, -6, 12, 4);
  for (const nx of [-27, 27]) { ctx.fillStyle = '#2e302c'; ctx.fillRect(nx > 0 ? 4 : -27, -7, 23, 5);
    ctx.fillStyle = '#4c4f47'; ctx.beginPath(); ctx.ellipse(nx, -8, 5, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#25261f'; ctx.fillRect(nx - 5, -10, 10, 3);
    ctx.fillStyle = u.cloaked ? 'rgba(160,255,200,0.5)' : 'rgba(255,170,60,0.85)'; ctx.beginPath(); ctx.arc(nx, 1, 2.6, 0, 7); ctx.fill();
    // rotor disc blur
    const sp = t * 40 + nx; ctx.strokeStyle = 'rgba(210,210,190,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(nx, -17, 16, 4.5, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,40,36,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx + Math.cos(sp) * 16, -17 + Math.sin(sp) * 4.5); ctx.lineTo(nx - Math.cos(sp) * 16, -17 - Math.sin(sp) * 4.5); ctx.stroke(); }
  // fuselage
  const g = ctx.createLinearGradient(0, -14, 0, 10); g.addColorStop(0, '#6f7266'); g.addColorStop(0.5, '#4d5047'); g.addColorStop(1, '#2c2d28');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(24, -2); ctx.quadraticCurveTo(22, -12, 8, -13); ctx.lineTo(-18, -11); ctx.lineTo(-26, -5); ctx.lineTo(-24, 6); ctx.lineTo(16, 8); ctx.quadraticCurveTo(25, 5, 24, -2); ctx.fill();
  ctx.strokeStyle = '#1b1c18'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(-8, 7); ctx.moveTo(4, -13); ctx.lineTo(4, 8); ctx.stroke();
  ctx.fillStyle = '#9fd3a0'; ctx.globalAlpha *= 0.9; ctx.beginPath(); ctx.moveTo(22, -3); ctx.quadraticCurveTo(20, -10, 11, -10); ctx.lineTo(10, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(13, -9, 5, 1.5);
  ctx.fillStyle = '#c9a227'; ctx.fillRect(-25, -4, 4, 9); ctx.fillStyle = '#1e1d1a'; for (let y = -4; y < 5; y += 3) ctx.fillRect(-25, y, 4, 1.5);
  ctx.fillStyle = u.team === ME ? '#4fa7d8' : '#c8402c'; ctx.fillRect(-4, -2, 6, 3);
  ctx.restore();
  if (u.cloaked && !hidden) { ctx.save(); ctx.strokeStyle = `rgba(150,255,220,${0.35 + 0.25 * Math.sin(t * 9)})`; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.ellipse(u.x, u.y - lift - 3, 30, 15, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  else if (hidden) { ctx.save(); ctx.strokeStyle = `rgba(200,255,230,${0.08 + 0.05 * Math.sin(t * 7)})`; ctx.beginPath(); ctx.ellipse(u.x, u.y - lift - 3, 26, 12, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  return { lift, hidden };
}
