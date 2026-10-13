import { Unit, Harvester } from './unit.js?v=10.1';
import { TILE } from '../data/stats.js?v=10.1';

// v10 special units: Brood Egg, Hive Orb (spawns Spark Drones), Brood Ship (Drop Eggs), Monster Truck (ram + rear rockets), Grazer.
export class Grazer extends Harvester { constructor(game, team, x, y) { super(game, team, x, y, 'grazer'); } }

// Egg: laid by a Brood Ship; pulses, cracks and hatches after hatchTime into temporary hatchlings. Vulnerable while incubating.
export class Egg extends Unit {
  constructor(game, team, x, y) { super(game, 'egg', team, x, y); this.inc = 0; }
  update(dt) {
    this.inc += dt; const s = this.stats;
    if (this.inc >= s.hatchTime) { const g = this.game, ship = this.ship, n = ship?.stats.hatchCount ?? 3, kind = ship?.stats.hatch ?? 'hatchling';
      for (let i = 0; i < n; i++) { const a = i / n * 7 + Math.random(), h = g.spawnUnit(kind, this.team, this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 6);
        h.life = h.stats.life ?? 50; h.lifeMax = h.life; h.anchor = { x: h.x, y: h.y }; }
      for (let i = 0; i < 8; i++) g.puff(this.x, this.y - 4, i % 2 ? '#c9e08a' : '#6f8f3a', 50, 2.5, 0.6, 20);
      g.removeQuiet(this); g.sfx?.('hatch', this); }
  }
}
// Brood Ship: slow tanky flyer, no gun. Drop Eggs at a point (or below it): costs credits, cooldown, max eggs alive.
export class BroodShip extends Unit {
  constructor(game, team, x, y) { super(game, 'broodship', team, x, y); this.eggs = []; this.eggCd = 0; }
  canUse() { this.eggs = this.eggs.filter(e => !e.dead); return this.eggCd <= 0 && this.eggs.length < this.stats.maxEggs && this.game.teams[this.team].credits >= this.stats.eggCost; }
  useAbility() { return this.castAt(this.x, this.y + 6); }
  castAt(x, y) { if (!this.canUse()) return false; this.order = { type: 'cast', x, y }; return true; }
  layEgg(x, y) { if (!this.canUse()) return false; const g = this.game; g.teams[this.team].credits -= this.stats.eggCost; this.eggCd = this.stats.eggCd;
    const e = g.spawnUnit('egg', this.team, x, y); e.ship = this; this.eggs.push(e); g.effects.push({ t: 0.5, dustRing: true, x, y, r: 12 }); g.sfx?.('egg', this); return e; }
  update(dt) {
    this.eggCd = Math.max(0, this.eggCd - dt); const o = this.order;
    if (o?.type === 'cast') { if (this.moveToward(o.x, o.y - 4, dt, 14)) { this.layEgg(o.x, o.y); this.order = null; } }
    else if (o?.type === 'move' || o?.type === 'attackMove') { if (this.moveToward(o.x, o.y, dt)) this.order = null; }
    else if (o?.type === 'attack') { if (!o.target || o.target.dead) this.order = null; else if (this.moveToward(o.target.x, o.target.y, dt, 40)) { this.castAt(o.target.x, o.target.y); } }
    this.separate(dt);
  }
}
// Hive Orb: hovering drone carrier; while an enemy is within launchRange it spawns temporary Spark Drones (max alive maxSpawn).
export class HiveOrb extends Unit {
  constructor(game, team, x, y) { super(game, 'hiveorb', team, x, y); this.brood = []; this.spawnT = 0; }
  update(dt) {
    const s = this.stats, g = this.game; this.brood = this.brood.filter(d => !d.dead); this.spawnT -= dt;
    const foe = g.combat ? g.findEnemyNear(this, s.launchRange * TILE, e => !e.dead && (!e.cloaked || e.detected)) : null;
    if (foe && this.spawnT <= 0 && this.brood.length < s.maxSpawn) { this.spawnT = s.spawnEvery;
      const d = g.spawnUnit(s.spawns, this.team, this.x + 18, this.y - 4); d.life = 30; d.lifeMax = 30; d.anchor = { x: this.x, y: this.y }; d.command({ type: 'attack', target: foe }); this.brood.push(d);
      g.effects.push({ t: 0.3, flash: true, x: this.x + 14, y: this.y - 10, r: 10 }); g.sfx?.('spawn', this); }
    const o = this.order; if (o && (o.type === 'move' || o.type === 'attackMove') && this.moveToward(o.x, o.y, dt)) this.order = null;
    if (o?.type === 'attack') { if (!o.target || o.target.dead) this.order = null; else if (this.dist(o.target) > s.launchRange * TILE * 0.8) this.moveToward(o.target.x, o.target.y, dt); }
    this.separate(dt);
  }
}
// Monster Truck: front machine guns (normal weapon) + rear rocket launcher; ramming deals contact damage scaled by speed
// (x2 vs infantry, x1.5 vs light vehicles), knocks targets back, crushes weakened infantry; Ram = 2.2 s speed burst + double ram damage.
export class Truck extends Unit {
  constructor(game, team, x, y, type = 'truck') { super(game, type, team, x, y); this.cool2 = 0; this.ramT = 0; this.abCd = 0; this.hitCd = new Map(); this.px = x; this.py = y; this.v = 0; }
  spd() { return this.stats.speed * (this.ramT > 0 ? 2.1 : 1); }
  canUse() { return this.abCd <= 0; }
  useAbility() { if (!this.canUse()) return false; this.ramT = 2.2; this.abCd = 12; this.game.sfx?.('ram', this);
    if (!this.order) { const tg = this.target && !this.target.dead ? this.target : null; const a = tg ? Math.atan2(tg.y - this.y, tg.x - this.x) : this.angle;
      this.order = { type: 'move', x: this.x + Math.cos(a) * 6 * TILE, y: this.y + Math.sin(a) * 6 * TILE }; } return true; }
  update(dt) {
    this.ramT = Math.max(0, this.ramT - dt); this.abCd = Math.max(0, this.abCd - dt); this.cool2 -= dt;
    super.update(dt);
    const g = this.game; this.v = Math.hypot(this.x - this.px, this.y - this.py) / Math.max(dt, 1e-3); this.px = this.x; this.py = this.y;
    for (const [e, t] of this.hitCd) { if (t - dt <= 0) this.hitCd.delete(e); else this.hitCd.set(e, t - dt); }
    if (g.combat && this.v > 20) for (const e of g.units) {
      if (e.team === this.team || e.dead || e.isAir || e.under || this.hitCd.has(e) || (e.cloaked && !e.detected) || e.carried) continue;
      const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1; if (d > this.radius + e.radius + 3) continue;
      const k = Math.min(1.6, this.v / this.stats.speed), mult = e.stats.inf ? 2 : e.stats.light ? 1.5 : 0.7;
      let dmg = this.stats.ram * k * mult * (this.ramT > 0 ? 2 : 1);
      if (e.stats.inf && k > 0.7 && e.hp <= dmg * 1.5) dmg = e.hp + 1; // crushed
      e.damage(dmg, this); e.x += dx / d * 22 * k; e.y += dy / d * 22 * k; this.hitCd.set(e, 0.6);
      g.effects.push({ t: 0.3, dustRing: true, x: e.x, y: e.y, r: 10 }); g.sfx?.('ramhit', this); if (this.team === this.game.me) g.shake = Math.max(g.shake, 1.5);
    }
    // rear rocket launcher: separate weapon, fires at the current target or anything in range
    const w = this.stats.rear; if (this.cool2 <= 0 && g.combat) {
      const t = this.target && !this.target.dead && this.canHit(this.target) && this.dist(this.target) < w.range * TILE ? this.target : g.findEnemyNear(this, w.range * TILE, e => this.canHit(e) || (e.isAir && !e.dead && (!e.cloaked || e.detected)));
      if (t) { this.cool2 = w.cooldown; const ts = t.stats, m = (ts.wall || ts.gate) ? w.vsWall : t.kind === 'unit' && !ts.inf ? w.vsVeh : 1; t.damage(w.damage * m, this); g.fxRocket?.(this, t); g.sfx?.('rocket', this); }
    }
  }
}
