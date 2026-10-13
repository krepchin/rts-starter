import { Unit } from './unit.js?v=10.1';
import { TILE } from '../data/stats.js?v=10.1';

// Home airfield for damaged aircraft (repaired there by Building.update).
export function homeField(u) { return u.game.nearestOwn(u, 'airfield'); }

// Fighter Jet: air superiority + hit-and-run. Missiles vs aircraft; on ground targets it makes a fast strafing
// pass (cannon), overshoots, banks away and comes round again. Low HP -> breaks off and flies home for repair.
export class Jet extends Unit {
  constructor(game, team, x, y) { super(game, 'jet', team, x, y); this.phase = 'run'; this.bank = 0; this.scool = 0; this.vx = 0; this.vy = 0; }
  steer(x, y, dt, stop = 6) { // momentum flight: heading turns at a limited rate so it banks through turns
    const want = Math.atan2(y - this.y, x - this.x); let d = want - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = Math.max(-1, Math.min(1, d / 0.4)) * 3.6 * dt; this.angle += turn; this.bank += ((turn / dt) / 3.6 - this.bank) * Math.min(1, dt * 6);
    const sp = this.stats.speed * dt; this.x += Math.cos(this.angle) * sp; this.y += Math.sin(this.angle) * sp;
    return Math.hypot(x - this.x, y - this.y) < stop + sp;
  }
  fireAt(t) {
    const w = this.stats.weapon, g = this.game; if (!g.combat || t.dead) return;
    if (t.isAir) { if (this.cool > 0 || this.dist(t) > w.range * TILE + t.radius) return; this.cool = w.cooldown; t.damage(w.damage * w.vsAir, this);
      g.effects.push({ t: 0.3, x1: this.x, y1: this.y, x2: t.x, y2: t.y, color: w.color, rocket: true }); if (this.team === this.game.me || t.team === this.game.me) g.sfx?.('rocket'); return; }
    const ahead = Math.cos(Math.atan2(t.y - this.y, t.x - this.x) - this.angle) > 0.8, d = this.dist(t); // strafe only while nose-on
    if (this.scool > 0 || !ahead || d > 4.5 * TILE + t.radius) return; this.scool = this.stats.strafe.cooldown;
    const mult = t.stats.inf ? 1 : t.kind === 'building' ? 0.6 : 0.8; t.damage(this.stats.strafe.damage * mult, this);
    const jx = (Math.random() - .5) * 14, jy = (Math.random() - .5) * 10;
    g.effects.push({ t: 0.08, x1: this.x + Math.cos(this.angle) * 10, y1: this.y + Math.sin(this.angle) * 10, x2: t.x + jx, y2: t.y + jy, color: '#ffe9a0' });
    if (Math.random() < 0.3) g.puff(t.x + jx, t.y + jy, '#d8c9a0', 20, 3, 0.4, 10);
    if (Math.random() < 0.35 && (this.team === g.me || t.team === g.me)) g.sfx?.('shot');
  }
  update(dt) {
    this.cool -= dt; this.scool -= dt; const g = this.game, o = this.order;
    if (this.hp < this.stats.hp * 0.3 && !this.goingHome) { const f = homeField(this); if (f) this.goingHome = f; }
    if (this.goingHome) { const f = this.goingHome; if (f.dead) this.goingHome = null;
      else { if (Math.hypot(f.x - this.x, f.y - this.y) > 30) this.steer(f.x, f.y, dt); else { this.x += Math.cos(this.angle += dt * 2.5) * 40 * dt; this.y += Math.sin(this.angle) * 40 * dt; this.bank *= 0.9; }
        if (this.hp >= this.stats.hp) this.goingHome = null; return; } }
    let t = o?.type === 'attack' ? o.target : null; if (t && !this.canHit(t)) { this.order = null; t = null; }
    if (!t) { if (!this.target || !this.canHit(this.target) || this.dist(this.target) > this.stats.sight * TILE * 1.6) this.target = g.findEnemyNear(this, this.stats.sight * TILE, e => this.canHit(e)); t = this.target; }
    if (t && (o?.type !== 'move')) {
      if (this.phase === 'run') { // dive through the target, then overshoot
        this.steer(t.x, t.y, dt); this.fireAt(t); if (this.dist(t) < 26 || (!t.isAir && this.dist(t) < 40)) { this.phase = 'break'; this.bx = t.x + Math.cos(this.angle) * 150 + Math.sin(this.angle) * 70; this.by = t.y + Math.sin(this.angle) * 150 - Math.cos(this.angle) * 70; }
      } else if (this.steer(this.bx, this.by, dt, 20)) this.phase = 'run';
      if (t.isAir) this.fireAt(t);
    } else if (o?.type === 'move' || o?.type === 'attackMove') { if (Math.hypot(o.x - this.x, o.y - this.y) > 24) this.steer(o.x, o.y, dt); else { this.order = null; this.anchor = { x: o.x, y: o.y }; } }
    else { const A = this.anchor || (this.anchor = { x: this.x, y: this.y }); // loiter: orbit the guard point
      const a = Math.atan2(this.y - A.y, this.x - A.x) + 0.9; this.steer(A.x + Math.cos(a) * 60, A.y + Math.sin(a) * 60, dt, 1); }
  }
}

// Stealth Bomber: flying wing, invisible to enemies (and their radar) unless they are within ~2.5 tiles or it has just
// bombed. Slow; attack order / attack-move on a ground target -> bomb run that lays a line of bombs, then reload.
// No air-to-air weapon: fighters and AA shred it.
export class Bomber extends Unit {
  constructor(game, team, x, y) { super(game, 'bomber', team, x, y); this.reload = 0; this.revealT = 0; this.bank = 0; }
  get stealthed() { return this.revealT <= 0; }
  hiddenFrom(viewer) { return this.stealthed && viewer.team !== this.team && Math.hypot(viewer.x - this.x, viewer.y - this.y) > 2.5 * TILE; }
  steer(x, y, dt, stop = 8) { const want = Math.atan2(y - this.y, x - this.x); let d = want - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = Math.max(-1, Math.min(1, d / 0.5)) * 1.6 * dt; this.angle += turn; this.bank += ((turn / dt) / 1.6 - this.bank) * Math.min(1, dt * 4);
    const sp = this.stats.speed * dt; this.x += Math.cos(this.angle) * sp; this.y += Math.sin(this.angle) * sp; return Math.hypot(x - this.x, y - this.y) < stop + sp * 2; }
  drop() { const B = this.stats.bombs, g = this.game; this.reload = B.reload; this.revealT = this.stats.stealth.reveal;
    for (let i = 0; i < B.count; i++) { const k = i - (B.count - 1) / 2; g.bombs.push({ team: this.team, src: this, t: 0.55 + i * 0.09, x: this.x + Math.cos(this.angle) * (k * B.spacing + 20), y: this.y + Math.sin(this.angle) * (k * B.spacing + 20), r: B.radius, dmg: B.damage }); }
    this.dropFx = 0.5; if (this.team === this.game.me) g.sfx?.('demo'); }
  update(dt) {
    this.reload -= dt; this.revealT -= dt; this.dropFx = (this.dropFx || 0) - dt; const o = this.order, g = this.game;
    let t = o?.type === 'attack' && o.target && !o.target.dead && !o.target.isAir && o.target.team !== this.team ? o.target : null;
    if (!t && o?.type === 'attackMove') t = g.findEnemyNear(this, this.stats.sight * TILE, e => !e.isAir && !e.dead && e.team !== this.team);
    if (t && g.combat) {
      if (this.reload > 0) { if (this.dist(t) < 4 * TILE) { this.steer(t.x - Math.cos(this.angle) * 300, t.y - Math.sin(this.angle) * 300, dt); } else this.steer(t.x, t.y, dt, 120); }
      else if (this.steer(t.x, t.y, dt, 22)) this.drop();
    } else if (o?.type === 'move' || o?.type === 'attackMove') { if (this.steer(o.x, o.y, dt, 14)) { this.order = null; this.anchor = { x: o.x, y: o.y }; } }
    else { if (o?.type === 'attack') this.order = null; const A = this.anchor || (this.anchor = { x: this.x, y: this.y }); const a = Math.atan2(this.y - A.y, this.x - A.x) + 0.6;
      this.steer(A.x + Math.cos(a) * 70, A.y + Math.sin(a) * 70, dt, 1); }
  }
}
