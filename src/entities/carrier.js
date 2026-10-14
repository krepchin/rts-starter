import { Unit } from './unit.js?v=10.0';
import { TILE } from '../data/stats.js?v=10.0';

// StarCraft-style carrier: no gun of its own, launches interceptors at targets within launchRange.
export class Carrier extends Unit {
  constructor(game, team, x, y, type = 'carrier') {
    super(game, type, team, x, y);
    this.docked = this.stats.interceptors; // ready in hangar
    this.wing = []; this.rebuild = 0;
  }
  update(dt) {
    const s = this.stats;
    // Hangar rebuilds lost interceptors over time.
    const total = this.docked + this.wing.filter(i => !i.dead).length;
    if (total < s.interceptors) { this.rebuild += dt; if (this.rebuild >= s.rebuildTime) { this.rebuild = 0; this.docked++; } }
    this.wing = this.wing.filter(i => !i.dead);
    // v9.2: a badly damaged carrier recalls its wing and limps home to the Airfield, which repairs it.
    if (this.hp < s.hp * 0.3 && !this.goingHome && this.order?.type !== 'move') { const f = this.game.nearestOwn(this, s.home || 'airfield'); if (f) this.goingHome = f; }
    if (this.goingHome) { const f = this.goingHome; if (f.dead || this.hp >= s.hp || this.order?.type === 'move') this.goingHome = null;
      else { for (const i of this.wing) i.target = null; this.moveToward(f.x, f.y, dt, 20); this.separate(dt); return; } }
    let target = this.order?.type === 'attack' && this.canHitT(this.order.target) ? this.order.target : null;
    if (!target) { if (!this.canHitT(this.target)) this.target = this.game.findEnemyNear(this, s.launchRange * TILE, e => this.canHitT(e)); target = this.target; }
    if (target && this.dist(target) <= s.launchRange * TILE + target.radius) {
      while (this.docked > 0) { this.docked--; this.wing.push(this.game.spawnInterceptor(this)); }
      for (const i of this.wing) if (!i.target || i.target.dead) i.target = target;
      if (this.order?.type === 'attack') this.order = this.order; // hold position while wing fights
    } else if (this.order?.type === 'attack' && target) {
      this.moveToward(target.x, target.y, dt);
    }
    if (this.order?.type === 'move' && this.moveToward(this.order.x, this.order.y, dt)) this.order = null;
    if (this.order?.type === 'attackMove' && !target && this.moveToward(this.order.x, this.order.y, dt)) this.order = null;
    if (this.order?.type === 'attack' && !this.canHitT(this.order.target)) this.order = null;
    this.separate(dt);
  }
  canHitT(t) { return t && this.game.combat && !t.dead && t.team !== this.team; }
}

export class Interceptor extends Unit {
  constructor(game, carrier, type) {
    super(game, type || carrier.stats.drone || 'interceptor', carrier.team, carrier.x, carrier.y);
    this.carrier = carrier; this.phase = Math.random() * Math.PI * 2;
    if (this.stats.orbs) { this.docked = this.stats.orbs; this.wing = []; } // v10.2 Grey mini-saucer: carries its own orb drones
  }
  update(dt) {
    this.cool -= dt; this.phase += dt * (this.stats.erratic ? 4 + Math.sin(this.id * 7 + this.phase) * 3 : 3);
    if (this.wing) { this.wing = this.wing.filter(i => !i.dead); const t = this.target;
      if (t && !t.dead && this.dist(t) < 5 * TILE) { while (this.docked > 0) { this.docked--; this.wing.push(this.game.spawnInterceptor(this, this.stats.orbType)); } for (const i of this.wing) if (!i.target || i.target.dead) i.target = t; } }
    const c = this.carrier, leash = c.stats.leashRange * TILE;
    const t = this.target;
    if (c.dead) { if (this.wing) { this.carrier = c.carrier; if (!this.carrier || this.carrier.dead) { this.damage(9999, null, true); return; } } else { this.damage(9999, null, true); return; } }
    if (t && !t.dead && c.dist(t) < leash) {
      // Strafe around the target.
      const R = this.stats.orbit || 30, ox = t.x + Math.cos(this.phase) * R, oy = t.y + Math.sin(this.phase * (this.stats.erratic ? 1.7 : 1)) * R;
      this.moveToward(ox, oy, dt, 2); this.tryFire(t, dt);
    } else {
      this.target = null;
      if (this.wing) for (const i of this.wing) i.target = null;
      if (this.moveToward(c.x, c.y, dt, 8) && !(this.wing && this.wing.length)) { this.dead = true; c.docked++; this.game.removeQuiet(this); } // re-dock (mini-saucers wait for their orbs; docking repairs + refills)
    }
  }
}
