import { Unit } from './unit.js';
import { UNITS, BUILDINGS, TILE } from '../data/stats.js';

// v8 mobile command centre.
//  'mcv'   = Construction Yard packed alone into a slow armored crawler.
//  'robot' = yard + barracks + one power plant + war factory transformed into one walking Base Walker.
// Both carry their buildings as { type, hpFrac } and unfold them again on Deploy (HP kept proportionally).
// Fixed deploy formation (tile offsets from the yard's top-left corner): barracks left, factory right, power behind.
export const FORMATION = { cy: [0, 0], barracks: [-3, 1], factory: [4, 0], power: [0, -3] };
export const DEPLOY_TIME = { mcv: 2.5, robot: 4 };
const ARMOR = 0.6; // carried bases take 60% damage: armored, but still vulnerable

export class MobileBase extends Unit {
  constructor(game, type, team, x, y, carried) {
    super(game, type, team, x, y);
    this.carried = carried; // [{type, hpFrac}]
    const maxHp = carried.reduce((s, c) => s + BUILDINGS[c.type].hp, 0);
    this.stats = { ...UNITS[type], hp: maxHp }; this.hp = carried.reduce((s, c) => s + BUILDINGS[c.type].hp * c.hpFrac, 0);
    this.state = 'rising'; this.stateT = 0; this.mode = 'spray'; this.burrowCd = 0; this.swapT = 0;
    this.walkPh = 0; this.spraying = 0; this.aimA = 0; this.faceRight = true;
  }
  has(t) { return this.carried.some(c => c.type === t); }
  get busy() { return this.state !== 'ready'; }
  get under() { return this.state === 'under'; }
  damage(n, src, force) { if (this.under) return; super.damage(n * ARMOR, src, force); }
  command(o) { if (this.state === 'ready' || this.state === 'rising') super.command(o); }
  footprint() { return this.carried.map(c => ({ type: c.type, dx: FORMATION[c.type][0], dy: FORMATION[c.type][1], w: BUILDINGS[c.type].w, h: BUILDINGS[c.type].h })); }
  setMode(m) { if (this.type !== 'robot' || this.busy || m === this.mode) return false; this.mode = m; this.swapT = 0.6; this.spraying = 0; return true; }
  toggleMode() { return this.setMode(this.mode === 'spray' ? 'drill' : 'spray'); }
  canBurrow() { return this.type === 'robot' && this.mode === 'drill' && this.state === 'ready' && this.burrowCd <= 0; }
  burrow(x, y) {
    if (!this.canBurrow()) return false;
    const m = this.game.map; this.dest = { x: Math.max(40, Math.min(m.pxW - 40, x)), y: Math.max(40, Math.min(m.pxH - 40, y)) };
    this.state = 'burrowing'; this.stateT = 0; this.order = null; this.target = null; return true;
  }
  startDeploy(tx, ty) {
    if (this.state !== 'ready' || !this.game.canDeploy(this, tx, ty)) return false;
    this.deployAt = { tx, ty }; if (this.team === 0) this.game.sfx?.('deploy'); this.state = 'deploying'; this.stateT = 0; this.order = null; return true;
  }
  burst(x, y, n, color, spd, size, life, up = 0) {
    const fx = this.game.effects; if (fx.length > 700) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = spd * (0.3 + Math.random() * 0.7);
      fx.push({ part: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55 - up * Math.random(), g: up ? up * 1.6 : 0, size: size * (0.6 + Math.random() * 0.8), color, t: life, life }); }
  }
  update(dt) {
    this.cool -= dt; this.burrowCd = Math.max(0, this.burrowCd - dt); this.swapT = Math.max(0, this.swapT - dt);
    this.spraying = Math.max(0, this.spraying - dt); this.stateT += dt;
    const g = this.game;
    if (this.state === 'rising') { if (this.stateT >= 0.9) { this.state = 'ready'; this.stateT = 0; } }
    else if (this.state === 'deploying') {
      if (Math.random() < dt * 14) this.burst(this.x + (Math.random() - .5) * 50, this.y, 2, '#b9a888', 40, 5, 0.8);
      if (this.stateT >= DEPLOY_TIME[this.type]) { if (!g.finishDeploy(this)) { this.state = 'ready'; this.stateT = 0; } }
      return;
    } else if (this.state === 'burrowing') {
      if (Math.random() < dt * 30) this.burst(this.x + (Math.random() - .5) * 40, this.y, 3, '#7a5a3a', 70, 4, 0.9, 60);
      if (this.stateT >= 1.1) { this.state = 'under'; this.stateT = 0; }
      return;
    } else if (this.state === 'under') {
      const d = this.dest, dx = d.x - this.x, dy = d.y - this.y, dist = Math.hypot(dx, dy), step = Math.min(dist, 95 * dt);
      if (dist > 2) { this.x += dx / dist * step; this.y += dy / dist * step; if (Math.abs(dx) > 2) this.faceRight = dx > 0; }
      if (Math.random() < dt * 20) this.burst(this.x, this.y, 1, '#6b4f33', 25, 4, 0.9);
      if (dist <= 2) { this.state = 'emerging'; this.stateT = 0; this.erupt(); }
      return;
    } else if (this.state === 'emerging') { if (this.stateT >= 0.8) { this.state = 'ready'; this.stateT = 0; this.anchor = { x: this.x, y: this.y }; } return; }
    // ready: walk + fight
    const o = this.order; let moved = false;
    const ox = this.x, oy = this.y;
    if (o?.type === 'move' || o?.type === 'attackMove') { if (this.moveToward(o.x, o.y, dt, 6)) this.order = null; moved = true; }
    const w = this.weapon();
    if (w && g.combat && this.swapT <= 0) {
      let tgt = o?.type === 'attack' && this.canHit(o.target) ? o.target : null;
      if (o?.type === 'attack' && !tgt) this.order = null;
      if (!tgt) tgt = g.findEnemyNear(this, w.range * TILE + 8, e => this.canHit(e));
      if (tgt) {
        const inRange = this.dist(tgt) <= w.range * TILE + tgt.radius;
        if (inRange) this.fire(w, tgt, dt);
        else if (o?.type === 'attack') { this.moveToward(tgt.x, tgt.y, dt, 4); moved = true; }
      }
    } else if (o?.type === 'attack') { if (!this.canHit(o.target)) this.order = null; else { this.moveToward(o.target.x, o.target.y, dt, w ? w.range * TILE : 30); moved = true; } }
    if (moved) { const d = Math.hypot(this.x - ox, this.y - oy); if (Math.abs(this.x - ox) > 0.05) this.faceRight = this.x > ox; this.stride(d); }
    this.separate(dt);
  }
  weapon() {
    if (this.type !== 'robot') return null;
    return this.mode === 'spray' ? { range: 3.5, cone: 0.5, vsB: 300, vsU: 45 } : { range: 1.4, cone: 1.2, vsB: 140, vsU: 70 };
  }
  canHit(t) { return this.game.combat && t && !t.dead && t.team !== this.team && !t.isAir && !t.under; }
  fire(w, tgt, dt) {
    const g = this.game, a = Math.atan2(tgt.y - this.y, tgt.x - this.x); this.aimA = a; this.faceRight = Math.cos(a) >= 0; this.spraying = 0.15;
    for (const e of [...g.buildings, ...g.units]) {
      if (!this.canHit(e)) continue; const d = this.dist(e); if (d > w.range * TILE + e.radius) continue;
      let da = Math.abs(Math.atan2(e.y - this.y, e.x - this.x) - a); if (da > Math.PI) da = 2 * Math.PI - da;
      if (e !== tgt && da > w.cone && d > e.radius) continue;
      e.damage((e.kind === 'building' ? w.vsB : w.vsU) * dt, this);
    }
    const fx = g.effects; if (fx.length > 700) return;
    if (this.mode === 'spray') { // sprayed Tiberium slurry: green droplets arcing from the shoulder nozzle into the cone
      const f = this.faceRight ? 1 : -1, nx = this.x + f * 6, ny = this.y - 66;
      for (let i = 0; i < 3; i++) { const aa = a + (Math.random() - .5) * w.cone * 1.6, r = (0.4 + Math.random() * 0.6) * w.range * TILE, life = 0.45;
        const tx = this.x + Math.cos(aa) * r, ty = this.y + Math.sin(aa) * r;
        fx.push({ part: true, x: nx, y: ny, vx: (tx - nx) / life, vy: (ty - ny) / life - 60, g: 260, size: 2.5 + Math.random() * 3, color: Math.random() < .6 ? '#7dff4a' : '#c8ff6a', glow: true, t: life, life }); }
      if (Math.random() < dt * 12) this.burst(tgt.x + (Math.random() - .5) * 20, tgt.y, 2, '#9f6', 20, 4, 0.7, 30); // melting fumes
    } else if (Math.random() < dt * 25) this.burst(this.x + Math.cos(a) * 34, this.y + Math.sin(a) * 34 - 20, 3, '#ffcf6a', 90, 2, 0.35);
  }
  erupt() {
    const g = this.game, r = 2.6 * TILE; this.burrowCd = 30;
    if (g.combat) for (const e of [...g.buildings, ...g.units]) if (e.team !== this.team && !e.dead && !e.isAir && Math.hypot(e.x - this.x, e.y - this.y) <= r + e.radius * 0.5) e.damage(220, this);
    g.sfx?.('boom'); g.effects.push({ t: 0.9, erupt: true, x: this.x, y: this.y, r });
    this.burst(this.x, this.y, 40, '#7a5a3a', 160, 6, 1.1, 140); this.burst(this.x, this.y, 16, '#8f5', 120, 3, 0.8, 100);
  }
  stride(d) {
    const before = this.walkPh; this.walkPh += d / (this.type === 'robot' ? 22 : 10);
    if (this.type === 'robot' && Math.floor(before / Math.PI) !== Math.floor(this.walkPh / Math.PI)) { // foot down: stomp dust
      const f = Math.floor(this.walkPh / Math.PI) % 2 ? 1 : -1; this.burst(this.x + f * 12, this.y + 4, 7, '#bfae8c', 45, 5, 0.9); this.stomp = 0.15;
    } else if (this.type === 'mcv' && Math.random() < 0.15) this.burst(this.x - (this.faceRight ? 22 : -22), this.y + 6, 1, '#bfae8c', 20, 4, 0.7);
  }
}
