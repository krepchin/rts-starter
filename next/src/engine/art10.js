// v9.2 painted strike craft (top-down, nose along +x) + repair glint. Gritty gunmetal with soft highlights, team accents.
function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
const P = { 0: { hi: '#a9b2a8', mid: '#5d675f', lo: '#2b302c' }, 1: { hi: '#b39a84', mid: '#6d4b3b', lo: '#2e1d16' } };

export function drawJet(ctx, u, t, col) {
  const p = P[u.team] || P[0], bank = u.bank || 0, ab = 0.75 + 0.25 * Math.sin(t * 40 + u.id);
  ctx.translate(u.x, u.y); ctx.rotate(u.angle); ctx.scale(1, 1 - Math.abs(bank) * 0.35); // banking foreshortens the wings
  // afterburner trail
  const tl = 26 + 8 * ab; ctx.fillStyle = grad(ctx, -10, 0, -10 - tl, 0, [[0, 'rgba(255,240,190,0.95)'], [0.25, 'rgba(255,150,50,0.7)'], [1, 'rgba(120,120,140,0)']]);
  ctx.beginPath(); ctx.moveTo(-9, -2.6); ctx.lineTo(-9 - tl, 0); ctx.lineTo(-9, 2.6); ctx.fill();
  ctx.shadowColor = '#ffb04a'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(-10, 0, 2.4 * ab, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  // wings (swept) then fuselage
  ctx.fillStyle = grad(ctx, 0, -14, 0, 14, [[0, bank > 0 ? p.lo : p.hi], [0.5, p.mid], [1, bank > 0 ? p.hi : p.lo]]); ctx.strokeStyle = '#151815'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-5, -13); ctx.lineTo(-9, -13); ctx.lineTo(-6, -2); ctx.lineTo(-6, 2); ctx.lineTo(-9, 13); ctx.lineTo(-5, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-13, -6); ctx.lineTo(-13, 6); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill(); ctx.stroke(); // tailplanes
  ctx.fillStyle = grad(ctx, 0, -3, 0, 3, [[0, p.hi], [0.6, p.mid], [1, p.lo]]);
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.quadraticCurveTo(8, -3.2, -10, -2.6); ctx.lineTo(-10, 2.6); ctx.quadraticCurveTo(8, 3.2, 15, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = grad(ctx, 4, -1.5, 9, 1.5, [[0, '#cfefff'], [1, '#2a4c66']]); ctx.beginPath(); ctx.ellipse(6, 0, 3.6, 1.4, 0, 0, 7); ctx.fill(); // canopy
  ctx.fillStyle = col; ctx.fillRect(-7, -12, 2, 3); ctx.fillRect(-7, 9, 2, 3); // team wingtips
  ctx.fillStyle = '#ddd'; ctx.fillRect(-2, -9, 5, 1.2); ctx.fillRect(-2, 7.8, 5, 1.2); // missiles on rails
  if (u.cool > u.stats.weapon.cooldown - 0.12) { ctx.fillStyle = 'rgba(255,220,150,0.9)'; ctx.beginPath(); ctx.arc(3, -9, 3, 0, 7); ctx.arc(3, 9, 3, 0, 7); ctx.fill(); }
  if (u.scool > u.stats.strafe.cooldown - 0.05) { ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(16, 0, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  // wingtip vapour in hard turns
  if (Math.abs(bank) > 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, -13); ctx.lineTo(-24, -13); ctx.moveTo(-7, 13); ctx.lineTo(-24, 13); ctx.stroke(); }
}

export function drawBomber(ctx, u, t, col) {
  const p = u.team === 1 ? { hi: '#5a4a44', mid: '#2e2624', lo: '#120d0c' } : { hi: '#55595a', mid: '#2a2e30', lo: '#0e1012' }, bank = u.bank || 0;
  ctx.translate(u.x, u.y); ctx.rotate(u.angle); ctx.scale(1, 1 - Math.abs(bank) * 0.25);
  // faint engine heat shimmer
  ctx.fillStyle = 'rgba(200,210,230,0.12)'; for (const y of [-6, 6]) { ctx.beginPath(); ctx.ellipse(-16 - Math.sin(t * 9 + y) * 2, y, 9, 2.2, 0, 0, 7); ctx.fill(); }
  // flying wing: sawtooth trailing edge
  const wing = [[16, 0], [-6, -32], [-12, -30], [-8, -20], [-14, -12], [-9, -4], [-13, 0], [-9, 4], [-14, 12], [-8, 20], [-12, 30], [-6, 32]];
  ctx.fillStyle = grad(ctx, 0, -32, 0, 32, [[0, bank > 0 ? p.lo : p.hi], [0.5, p.mid], [1, bank > 0 ? p.hi : p.lo]]); ctx.strokeStyle = '#050606'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(...wing[0]); for (const q of wing.slice(1)) ctx.lineTo(...q); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = grad(ctx, 14, 0, -8, 0, [[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]); ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-4, -8); ctx.lineTo(-6, 0); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill(); // spine sheen
  ctx.fillStyle = '#20343c'; ctx.beginPath(); ctx.moveTo(10, -1.5); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.lineTo(10, 1.5); ctx.fill(); // cockpit slit
  ctx.strokeStyle = col; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.moveTo(-6, -31); ctx.lineTo(-10, -29); ctx.moveTo(-6, 31); ctx.lineTo(-10, 29); ctx.stroke(); ctx.globalAlpha /= 0.6;
  if (u.dropFx > 0) { ctx.fillStyle = '#111'; ctx.fillRect(-4, -5, 8, 10); ctx.fillStyle = '#c9a227'; for (let i = 0; i < 3; i++) ctx.fillRect(-2 - i * 3, -1, 2, 2); } // bomb bay open
}

export function drawRepairGlint(ctx, x, y, t) {
  ctx.save(); ctx.shadowColor = '#6f6'; ctx.shadowBlur = 6; ctx.fillStyle = (t * 3 % 1) < 0.5 ? '#7f7' : '#3c3';
  ctx.fillRect(x - 4, y - 1.2, 8, 2.4); ctx.fillRect(x - 1.2, y - 4, 2.4, 8);
  for (let i = 0; i < 2; i++) { ctx.fillStyle = '#ffd27a'; ctx.fillRect(x + (Math.random() - .5) * 16, y + 6 + Math.random() * 6, 1.5, 1.5); }
  ctx.restore();
}
