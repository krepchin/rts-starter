import { TILE } from '../data/stats.js?v=10.1n';
import { getSprite } from './sprites.js?v=10.1n';

// Procedural C&C-style 2.5D structures. Each building sits on its tile footprint; height is drawn "up" the screen
// (oblique projection), so gameplay stays on the flat tile grid. Player = clean blue/steel tech, enemy = red/rust angular.
export const PALETTES = {
  0: { pad: '#2b333b', padEdge: '#1a2027', wall: '#4f6579', wallD: '#344453', roof: '#8aa2b6', roofL: '#b4c8d8', dark: '#16202a',
       accent: '#3fa9ff', glow: '#7fd8ff', light: '#e8f7ff', metal: '#a8bccc', chamfer: 3, angular: false },
  1: { pad: '#302724', padEdge: '#1d1513', wall: '#6b3b2b', wallD: '#47251b', roof: '#91603f', roofL: '#b07a52', dark: '#22110c',
       accent: '#ff4a3a', glow: '#ff9a50', light: '#ffd8b0', metal: '#857262', chamfer: 9, angular: true },
};

function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function outline(x, y, w, d, c) {
  c = Math.min(c, w / 3, d / 3);
  return c <= 0 ? [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]
    : [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + d - c], [x + w - c, y + d], [x + c, y + d], [x, y + d - c], [x, y + c]];
}
// Extruded block: footprint (x,y,w,d) raised by h. Draws visible (south/east/west-facing) walls, then the roof.
function block(ctx, P, x, y, w, d, h, o = {}) {
  const pts = outline(x, y, w, d, o.c ?? P.chamfer), n = pts.length;
  ctx.lineWidth = 1; ctx.strokeStyle = P.dark;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], nx = b[1] - a[1], ny = -(b[0] - a[0]);
    if (ny <= 0.01) continue;
    ctx.fillStyle = nx > 0.01 ? (o.wallD || P.wallD) : nx < -0.01 ? (o.wallD || P.wallD) : (o.wall || P.wall);
    poly(ctx, [[a[0], a[1] - h], [b[0], b[1] - h], [b[0], b[1]], [a[0], a[1]]]); ctx.fill(); ctx.stroke();
  }
  const top = pts.map(p => [p[0], p[1] - h]);
  const g = ctx.createLinearGradient(x, y - h, x + w * 0.4, y + d - h);
  g.addColorStop(0, o.roofL || P.roofL); g.addColorStop(1, o.roof || P.roof);
  ctx.fillStyle = g; poly(ctx, top); ctx.fill(); ctx.stroke();
  return { x, y: y - h, w, d };
}
function cylinder(ctx, P, cx, cy, r, h, o = {}) {
  const ry = r * 0.45, g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, o.wall || P.wall); g.addColorStop(0.35, o.roofL || P.roofL); g.addColorStop(1, o.wallD || P.wallD);
  ctx.fillStyle = g; ctx.strokeStyle = P.dark;
  ctx.beginPath(); ctx.moveTo(cx - r, cy - h); ctx.lineTo(cx - r, cy); ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + r, cy - h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.top || P.roof; ctx.beginPath(); ctx.ellipse(cx, cy - h, r, ry, 0, 0, 7); ctx.fill(); ctx.stroke();
}
function glowDot(ctx, x, y, r, col, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = col; ctx.shadowBlur = r * 3; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
function blink(t, period, phase = 0) { return ((t + phase) % period) < period * 0.5; }
function pad(ctx, P, X, Y, W, H) {
  ctx.fillStyle = '#0006'; ctx.fillRect(X + 4, Y + 4, W, H); // drop shadow
  ctx.fillStyle = P.pad; poly(ctx, outline(X + 1, Y + 1, W - 2, H - 2, P.angular ? 6 : 2)); ctx.fill();
  ctx.strokeStyle = P.padEdge; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  if (P.angular) { // rust hazard stripes on the south edge
    ctx.save(); poly(ctx, [[X + 4, Y + H - 6], [X + W - 4, Y + H - 6], [X + W - 4, Y + H - 2], [X + 4, Y + H - 2]]); ctx.clip();
    for (let x = X - 8; x < X + W; x += 8) { ctx.fillStyle = '#c9a02a'; poly(ctx, [[x, Y + H], [x + 4, Y + H], [x + 8, Y + H - 8], [x + 4, Y + H - 8]]); ctx.fill(); }
    ctx.restore();
  } else { // clean corner markers
    ctx.strokeStyle = P.accent + '88';
    for (const [cx, cy, sx, sy] of [[X + 4, Y + 4, 1, 1], [X + W - 4, Y + 4, -1, 1], [X + 4, Y + H - 4, 1, -1], [X + W - 4, Y + H - 4, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + 6 * sx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + 6 * sy); ctx.stroke();
    }
  }
}
function emblem(ctx, P, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = P.accent; ctx.fillStyle = P.accent; ctx.lineWidth = 2;
  if (P.angular) { poly(ctx, [[0, -s], [s * 0.9, s * 0.6], [-s * 0.9, s * 0.6]]); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.25, 0, 7); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, 7); ctx.stroke(); poly(ctx, [[0, -s * 0.55], [s * 0.45, s * 0.35], [-s * 0.45, s * 0.35]]); ctx.fill(); }
  ctx.restore();
}
function windows(ctx, P, x, y, n, w, gap, lit) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = lit ? P.glow : '#223'; ctx.globalAlpha = lit ? 0.85 : 1; ctx.fillRect(x + i * (w + gap), y, w, 3); }
  ctx.globalAlpha = 1;
}
function spikes(ctx, P, x, y, w, n) { // angular enemy roof fins
  ctx.fillStyle = P.wallD; ctx.strokeStyle = P.dark;
  for (let i = 0; i < n; i++) { const sx = x + (i + 0.5) * w / n; poly(ctx, [[sx - 3, y], [sx + 3, y], [sx + 1, y - 8]]); ctx.fill(); ctx.stroke(); }
}
function fan(ctx, P, x, y, r, a) {
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = P.metal; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) { const b = a + k * 2.094; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * r * 0.9, y + Math.sin(b) * r * 0.5); ctx.stroke(); }
  ctx.lineWidth = 1;
}
function smoke(ctx, x, y, t, n = 3, col = '#9aa') {
  for (let i = 0; i < n; i++) { const p = ((t * 0.6 + i / n) % 1); ctx.globalAlpha = 0.35 * (1 - p); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 3 * p, y - p * 22, 3 + p * 6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// Light animated overlays on top of the raster sprites (only where they fit the art).
function overlay(ctx, P, b, X, Y, W, H, t, s, top, sw, sh) {
  const cx = X + W / 2;
  if (b.type === 'radar') {
    if (s.powered) glowDot(ctx, cx + 4 + Math.sin(t * 1.6) * 9, top + sh * 0.18, 2, P.glow, 0.5 + 0.5 * Math.abs(Math.cos(t * 1.6)));
    else { ctx.fillStyle = '#f55'; ctx.font = 'bold 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OFFLINE', cx, Y + H - 4); }
  } else if (b.type === 'turret') {
    if (b.flash > 0) glowDot(ctx, cx + Math.cos(b.aim) * 14, Y + H / 2 - 6 + Math.sin(b.aim) * 8, 4, '#9ff');
  } else if (b.type === 'ion') {
    const f = s.charge; glowDot(ctx, cx, top + 4, 2 + f * 4 + (f >= 1 ? Math.sin(t * 8) * 1.5 : 0), f >= 1 ? '#fff' : P.glow, s.powered ? 0.3 + f * 0.7 : 0.15);
  } else if (b.type === 'factory' && s.busy) {
    glowDot(ctx, cx - sw * 0.2, Y + H - 14, 2.2, '#ffcc33', blink(t, 0.6) ? 1 : 0.2); glowDot(ctx, cx + sw * 0.05, Y + H - 6, 2.2, '#ffcc33', blink(t, 0.6, 0.3) ? 1 : 0.2);
  } else if (b.type === 'power' && s.powered) {
    glowDot(ctx, cx - sw * 0.2, top + sh * 0.2, 3, P.glow, 0.35 + 0.35 * Math.sin(t * 3));
  }
}

const ART = {
  // v9.2 Repair Center: open service pad with a gantry crane, arm with welding sparks when a vehicle is on the pad.
  repairbay(ctx, P, b, X, Y, W, H, t, s) {
    ctx.fillStyle = '#3a3f38'; poly(ctx, outline(X + 5, Y + 10, W - 10, H - 14, 4)); ctx.fill(); ctx.strokeStyle = P.dark; ctx.stroke();
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(X + 12, Y + 18, W - 24, H - 28); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = '#c9a227'; for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(X + 14 + i * 9, Y + H - 9); ctx.transform(1, 0, -0.6, 1, 0, 0); ctx.fillRect(0, 0, 4, 4); ctx.restore(); }
    block(ctx, P, X + 4, Y + 8, 8, 8, 34, { c: 1 }); block(ctx, P, X + W - 12, Y + 8, 8, 8, 34, { c: 1 }); // gantry legs
    block(ctx, P, X + 2, Y + 4, W - 4, 7, 6, { c: 1, roof: P.metal }); // beam (raised 34)
    const hx = X + W / 2 + Math.sin(t * 0.8) * (W * 0.25), busy = !!b.fixing;
    ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(hx, Y - 30); ctx.lineTo(hx, Y + H / 2 - 12); ctx.stroke();
    ctx.fillStyle = '#d0a020'; ctx.fillRect(hx - 4, Y + H / 2 - 14, 8, 5);
    if (busy && s.powered) for (let i = 0; i < 3; i++) glowDot(ctx, hx + (Math.random() - .5) * 8, Y + H / 2 - 6 + Math.random() * 4, 1.5 + Math.random() * 2, i ? '#ffd27a' : '#fff', 0.9);
    glowDot(ctx, X + 8, Y - 28, 2.5, busy ? '#6f6' : P.accent, blink(t, busy ? 0.3 : 1.2) ? 1 : 0.3);
    ctx.fillStyle = '#e8e8e0'; ctx.fillRect(X + W - 22, Y + H - 18, 10, 3); ctx.fillRect(X + W - 18.5, Y + H - 21.5, 3, 10); // wrench-cross decal
  },
  cy(ctx, P, b, X, Y, W, H, t, s) {
    const r = block(ctx, P, X + 8, Y + 34, W - 16, H - 42, 22);
    windows(ctx, P, X + 14, Y + H - 14, 6, 8, 5, s.powered);
    block(ctx, P, X + 12, Y + 36, 30, 22, 44, { c: P.angular ? 7 : 2 });
    windows(ctx, P, X + 16, Y + 50, 3, 6, 3, s.powered);
    emblem(ctx, P, r.x + r.w - 22, r.y + r.d / 2, 9);
    // Construction crane: mast + slowly swinging boom
    const mx = X + W - 22, my = Y + 30; ctx.strokeStyle = P.metal; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mx, my + 6); ctx.lineTo(mx, my - 34); ctx.stroke();
    const a = -Math.PI / 2 - 1.2 + Math.sin(t * (s.busy ? 0.9 : 0.25)) * 0.9, bx = mx + Math.cos(a) * 40, by = my - 34 + Math.sin(a) * 18;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my - 34); ctx.lineTo(bx, by); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 12 + Math.sin(t * 2) * 3); ctx.stroke(); ctx.lineWidth = 1;
    if (P.angular) spikes(ctx, P, X + 12, Y + 36 - 44, 30, 3);
    glowDot(ctx, mx, my - 36, 2, '#f44', blink(t, 1.2) ? 1 : 0.15);
    if (s.busy) glowDot(ctx, bx, by + 14, 2, '#ffcc33', blink(t, 0.3) ? 1 : 0.3);
  },
  power(ctx, P, b, X, Y, W, H, t, s) {
    block(ctx, P, X + 6, Y + 38, W - 12, H - 44, 10);
    const pulse = s.powered ? 0.6 + 0.4 * Math.sin(t * 3) : 0.15;
    for (const [cx, cy, h] of [[X + 21, Y + 46, 30], [X + 44, Y + 50, 24]]) {
      cylinder(ctx, P, cx, cy, 11, h);
      ctx.save(); ctx.globalAlpha = pulse; ctx.shadowColor = P.glow; ctx.shadowBlur = 14; ctx.fillStyle = P.glow;
      ctx.beginPath(); ctx.ellipse(cx, cy - h, 7, 3, 0, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = P.glow; ctx.globalAlpha = pulse * 0.8; ctx.fillRect(cx - 1.5, cy - h + 6, 3, h - 10); ctx.globalAlpha = 1;
      if (P.angular) spikes(ctx, P, cx - 10, cy - h - 2, 20, 2); else smoke(ctx, cx, cy - h - 2, t + cx, 2, '#bcd');
    }
  },
  refinery(ctx, P, b, X, Y, W, H, t, s) {
    // dock pad where harvesters unload
    ctx.fillStyle = '#1b2116'; ctx.fillRect(X + W / 2 - 20, Y + H - 16, 40, 14);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#222' : '#c9a02a'; ctx.fillRect(X + W / 2 - 20 + i * 8, Y + H - 16, 8, 2); }
    ctx.fillStyle = '#5f9'; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 4); poly(ctx, [[X + W / 2 - 5, Y + H - 9], [X + W / 2 + 5, Y + H - 9], [X + W / 2, Y + H - 4]]); ctx.fill(); ctx.globalAlpha = 1;
    const r = block(ctx, P, X + 6, Y + 22, 54, 26, 22);
    fan(ctx, P, r.x + 16, r.y + r.d / 2, 7, t * (s.powered ? 6 : 0.5));
    if (P.angular) spikes(ctx, P, r.x + 30, r.y + 4, 20, 2); else emblem(ctx, P, r.x + 38, r.y + r.d / 2, 6);
    // silo with tiberium level window
    const sx = X + W - 20, sy = Y + 44; cylinder(ctx, P, sx, sy, 13, 34);
    ctx.fillStyle = '#0a1a10'; ctx.fillRect(sx - 3, sy - 30, 6, 26);
    const lvl = (Math.sin(t * 0.7) * 0.5 + 0.5) * 22 + 2; ctx.fillStyle = '#4f8'; ctx.shadowColor = '#3f6'; ctx.shadowBlur = 8;
    ctx.fillRect(sx - 3, sy - 4 - lvl, 6, lvl); ctx.shadowBlur = 0;
    // pipe
    ctx.strokeStyle = P.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X + 60, Y + 30); ctx.lineTo(sx - 13, Y + 30); ctx.stroke();
    ctx.strokeStyle = '#5f9'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.moveTo(X + 60, Y + 30); ctx.lineTo(sx - 13, Y + 30); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  },
  barracks(ctx, P, b, X, Y, W, H, t, s) {
    if (P.angular) { // angular tent bunker
      ctx.fillStyle = P.wall; ctx.strokeStyle = P.dark;
      poly(ctx, [[X + 8, Y + 54], [X + W - 8, Y + 54], [X + W - 8, Y + 44], [X + W / 2, Y + 22], [X + 8, Y + 44]]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.roof; poly(ctx, [[X + 8, Y + 44], [X + W / 2, Y + 22], [X + W / 2, Y + 30], [X + 14, Y + 46]]); ctx.fill(); ctx.stroke();
    } else { // quonset hut
      block(ctx, P, X + 8, Y + 34, W - 16, 22, 8);
      const g = ctx.createLinearGradient(0, Y + 14, 0, Y + 40); g.addColorStop(0, P.roofL); g.addColorStop(1, P.wall);
      ctx.fillStyle = g; ctx.strokeStyle = P.dark; ctx.beginPath(); ctx.moveTo(X + 8, Y + 48); ctx.ellipse(X + W / 2, Y + 48, (W - 16) / 2, 26, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(X + W / 2, Y + 48, (W - 16) / 2 * i / 4, 26, 0, Math.PI, 1.5 * Math.PI); ctx.stroke(); }
    }
    ctx.fillStyle = P.dark; ctx.fillRect(X + W / 2 - 6, Y + 44, 12, 10); ctx.fillStyle = P.glow; ctx.globalAlpha = s.busy ? 0.9 : 0.3; ctx.fillRect(X + W / 2 - 5, Y + 45, 10, 2); ctx.globalAlpha = 1;
    // flag + antenna
    const fx = X + W - 12, fy = Y + 6; ctx.strokeStyle = P.metal; ctx.beginPath(); ctx.moveTo(fx, fy + 30); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = P.accent; ctx.beginPath(); ctx.moveTo(fx, fy);
    for (let i = 0; i <= 4; i++) ctx.lineTo(fx - i * 3.5, fy + Math.sin(t * 5 + i) * 1.5 + (P.angular ? i * 0.6 : 0));
    ctx.lineTo(fx - 14, fy + 7); for (let i = 4; i >= 0; i--) ctx.lineTo(fx - i * 3.5, fy + 7 + Math.sin(t * 5 + i) * 1.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.metal; ctx.beginPath(); ctx.moveTo(X + 12, Y + 40); ctx.lineTo(X + 12, Y + 16); ctx.stroke();
    glowDot(ctx, X + 12, Y + 16, 1.5, '#f44', blink(t, 1, 0.3) ? 1 : 0.2);
  },
  factory(ctx, P, b, X, Y, W, H, t, s) {
    ctx.fillStyle = '#0005'; ctx.fillRect(X + W / 2 - 22, Y + H - 12, 44, 10); // apron
    const r = block(ctx, P, X + 6, Y + 36, W - 12, H - 46, 28);
    // garage door on the south wall: opens while producing
    const dx = X + W / 2 - 20, dy = Y + H - 10 - 26, open = s.busy ? (Math.sin(t * 1.5) * 0.5 + 0.5) : 0;
    ctx.fillStyle = '#0b0f12'; ctx.fillRect(dx, dy, 40, 26);
    ctx.fillStyle = P.metal; const dh = 26 * (1 - open * 0.8);
    for (let y = 0; y < dh; y += 4) ctx.fillRect(dx + 1, dy + y, 38, 3);
    if (open > 0.2) glowDot(ctx, X + W / 2, dy + 22, 3, '#ffcc33', open);
    fan(ctx, P, r.x + 18, r.y + 12, 8, t * (s.powered ? 7 : 0.4));
    fan(ctx, P, r.x + 40, r.y + 12, 8, -t * (s.powered ? 6 : 0.3));
    if (P.angular) spikes(ctx, P, r.x + 52, r.y + 6, 24, 3); else emblem(ctx, P, r.x + r.w - 16, r.y + r.d - 12, 7);
    cylinder(ctx, P, X + W - 16, Y + 34, 5, 46, { top: '#111' }); smoke(ctx, X + W - 16, Y + 34 - 48, t, 3, s.busy ? '#888' : '#556');
    glowDot(ctx, X + 12, Y + H - 12, 2, s.busy ? '#ffcc33' : P.accent, blink(t, 0.8) ? 1 : 0.2);
    glowDot(ctx, X + W - 12, Y + H - 12, 2, s.busy ? '#ffcc33' : P.accent, blink(t, 0.8, 0.4) ? 1 : 0.2);
  },
  airfield(ctx, P, b, X, Y, W, H, t, s) {
    ctx.fillStyle = '#12161a'; ctx.fillRect(X + 4, Y + H - 24, W - 8, 18);
    ctx.strokeStyle = '#ddd8'; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(X + 8, Y + H - 15); ctx.lineTo(X + W - 8, Y + H - 15); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) { const on = Math.floor(t * 8) % 8 === i; const lx = X + 8 + i * (W - 16) / 7;
      glowDot(ctx, lx, Y + H - 24, 1.3, P.glow, on ? 1 : 0.25); glowDot(ctx, lx, Y + H - 6, 1.3, P.glow, on ? 1 : 0.25); }
    const r = block(ctx, P, X + 40, Y + 18, W - 46, 18, 14);
    if (P.angular) spikes(ctx, P, r.x + 6, r.y + 2, r.w - 12, 3);
    cylinder(ctx, P, X + 20, Y + 36, 7, 30);
    ctx.fillStyle = P.glow; ctx.globalAlpha = s.powered ? 0.8 : 0.25; ctx.fillRect(X + 13, Y + 36 - 32, 14, 6); ctx.globalAlpha = 1;
    ctx.fillStyle = P.roof; ctx.beginPath(); ctx.ellipse(X + 20, Y + 36 - 33, 9, 4, 0, 0, 7); ctx.fill(); ctx.stroke();
    const a = t * 3; glowDot(ctx, X + 20 + Math.cos(a) * 4, Y + 36 - 37, 2, '#fff', 0.5 + 0.5 * Math.sin(a));
  },
  radar(ctx, P, b, X, Y, W, H, t, s) {
    const r = block(ctx, P, X + 7, Y + 32, W - 14, 24, 16);
    windows(ctx, P, X + 12, Y + 48, 4, 6, 4, s.powered);
    if (P.angular) spikes(ctx, P, r.x + 4, r.y + 2, 18, 2);
    const mx = X + W / 2 + 6, my = r.y + 10; ctx.strokeStyle = P.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 18); ctx.stroke(); ctx.lineWidth = 1;
    const a = s.powered ? t * 1.6 : 0.6, rx = Math.abs(Math.cos(a)) * 15 + 2, face = Math.cos(a) > 0;
    ctx.fillStyle = face ? P.roofL : P.wallD; ctx.strokeStyle = P.dark;
    ctx.beginPath(); ctx.ellipse(mx, my - 22, rx, 11, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = P.metal; ctx.beginPath(); ctx.moveTo(mx, my - 22); ctx.lineTo(mx + Math.sin(a) * 10, my - 28); ctx.stroke();
    glowDot(ctx, mx + Math.sin(a) * 10, my - 28, 1.6, s.powered ? P.glow : '#555');
    glowDot(ctx, X + 10, Y + 18, 1.5, '#f44', blink(t, 1.4) ? 1 : 0.15);
    if (!s.powered) { ctx.fillStyle = '#f55'; ctx.font = 'bold 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OFFLINE', X + W / 2, Y + H - 2); }
  },
  turret(ctx, P, b, X, Y, W, H, t, s) {
    cylinder(ctx, P, X + 16, Y + 22, 11, 7);
    ctx.save(); ctx.translate(X + 16, Y + 15); ctx.rotate(b.aim || 0);
    ctx.fillStyle = P.roof; ctx.strokeStyle = P.dark;
    if (P.angular) poly(ctx, [[-7, -6], [5, -7], [8, 0], [5, 7], [-7, 6]]); else { ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); }
    ctx.fill(); ctx.stroke(); ctx.fillStyle = P.metal; ctx.fillRect(4, -2, 12, 4); ctx.strokeRect(4, -2, 12, 4);
    if (b.flash > 0) glowDot(ctx, 17, 0, 4, '#9ff'); ctx.restore();
    glowDot(ctx, X + 16, Y + 15, 2, s.powered ? P.glow : '#444', s.powered ? 0.6 + 0.4 * Math.sin(t * 4) : 1);
  },
  ion(ctx, P, b, X, Y, W, H, t, s) {
    block(ctx, P, X + 6, Y + 40, W - 12, 18, 8);
    const cx = X + W / 2, base = Y + 50, top = Y - 16, f = s.charge;
    const g = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0); g.addColorStop(0, P.wall); g.addColorStop(0.4, P.roofL); g.addColorStop(1, P.wallD);
    ctx.fillStyle = g; ctx.strokeStyle = P.dark;
    poly(ctx, P.angular ? [[cx - 15, base], [cx + 15, base], [cx + 6, top + 10], [cx + 9, top], [cx - 9, top], [cx - 6, top + 10]] : [[cx - 14, base], [cx + 14, base], [cx + 5, top], [cx - 5, top]]);
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) { const yy = base - 12 - i * 13, lit = f > (i + 1) / 4 - 0.001 || (f > i / 4 && blink(t, 0.4));
      ctx.strokeStyle = lit ? P.glow : '#334'; ctx.lineWidth = 2; ctx.shadowColor = P.glow; ctx.shadowBlur = lit ? 8 : 0;
      ctx.beginPath(); ctx.ellipse(cx, yy, 13 - i * 2, 4, 0, 0, 7); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.lineWidth = 1;
    glowDot(ctx, cx, top - 3, 3 + f * 3 + (f >= 1 ? Math.sin(t * 8) * 1.5 : 0), f >= 1 ? '#fff' : P.glow, s.powered ? 0.4 + f * 0.6 : 0.2);
  },
};

// Draw a building. `b` needs type, team, tx, ty, w, h (and optional age/aim/flash/charge). State flags are derived from the game.
export function drawBuildingArt(ctx, b, t, game) {
  const P = PALETTES[b.team] || PALETTES[0], X = b.tx * TILE, Y = b.ty * TILE, W = b.w * TILE, H = b.h * TILE;
  const team = game?.teams[b.team];
  const cat = { cy: 'building', barracks: 'infantry', factory: 'vehicle', airfield: 'aircraft' }[b.type];
  const s = {
    powered: b.powered !== false,
    busy: !!(team && cat && team.queues[cat].length && !team.paused[cat] && !team.stalled[cat]),
    charge: b.stats?.superweapon ? b.charge / b.stats.superweapon.chargeTime : 0,
  };
  const build = Math.min(1, (b.age ?? 9) / 1.2); // rise-up animation when placed
  const spr = getSprite(b.type === 'cy' ? 'cy' : 'b_' + b.type, b.team);
  ctx.save();
  const fr = b.faceRight ?? game?.teams?.[b.team]?.startLeft; // v9.2: face the enemy (art is drawn facing left natively)
  if (fr) { ctx.translate(2 * (X + W / 2), 0); ctx.scale(-1, 1); }
  if (!spr) pad(ctx, P, X, Y, W, H);
  if (build < 1) { ctx.beginPath(); ctx.rect(X - 20, Y + H - (H + 80) * build, W + 40, (H + 80) * build + 4); ctx.clip(); }
  if (spr) { // approved isometric artwork (enemy copy is red-tinted); footprint stays the 3x3 tile grid
    const sw = W * 1.38, sh = sw * spr.aspect;
    // Slab sits on the footprint: bottom vertex at the footprint's bottom edge; tight contact shadow only.
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.moveTo(X + W / 2, Y + H + 3); ctx.lineTo(X + W / 2 + sw * 0.5, Y + H - sh * 0.3); ctx.lineTo(X + W / 2, Y + H - sh * 0.62); ctx.lineTo(X + W / 2 - sw * 0.5, Y + H - sh * 0.3); ctx.closePath(); ctx.fill();
    if (!s.powered) ctx.filter = 'brightness(0.6)'; // dim when unpowered (no-op where ctx.filter is unsupported)
    ctx.drawImage(spr.img, X + W / 2 - sw / 2, Y + H + 1 - sh, sw, sh); ctx.filter = 'none';
    const top = Y + H + 1 - sh, cx = X + W / 2;
    glowDot(ctx, cx, Y + H - 2, 2.5, P.accent, blink(t, 1.2) ? 1 : 0.3); // team beacon
    overlay(ctx, P, b, X, Y, W, H, t, s, top, sw, sh);
  } else ART[b.type]?.(ctx, P, b, X, Y, W, H, t, s);
  ctx.restore();
  if (build < 1) { ctx.strokeStyle = P.glow; ctx.globalAlpha = 0.8; const yy = Y + H - (H + 60) * build; ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + W, yy); ctx.stroke(); ctx.globalAlpha = 1; }
  if (b.hp !== undefined && b.hp < b.stats.hp * 0.5) { // damage fire + smoke
    for (let i = 0; i < (b.hp < b.stats.hp * 0.25 ? 2 : 1); i++) {
      const fx = X + W * (0.3 + 0.4 * i), fy = Y + H * 0.35;
      glowDot(ctx, fx, fy, 3 + Math.sin(t * 15 + i) * 1.2, '#ff7a1a', 0.9); smoke(ctx, fx, fy - 2, t + i, 3, '#333');
    }
  }
  if (b.repairing) { const a = blink(t, 0.6); ctx.fillStyle = a ? '#6f6' : '#3a3'; ctx.fillRect(X + W / 2 - 7, Y + H / 2 - 2, 14, 4); ctx.fillRect(X + W / 2 - 2, Y + H / 2 - 7, 4, 14); }
}
