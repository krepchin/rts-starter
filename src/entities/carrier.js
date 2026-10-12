import { Unit } from './unit.js';
import { TILE } from '../data/stats.js';

// StarCraft-style carrier: no gun of its own, launches interceptors at targets within launchRange.
export class Carrier extends Unit {
  constructor(game, team, x, y) {
    super(game, 'carrier', team, x, y);
    this.docked = this.stats.interceptors; // ready in hangar
    this.wing = []; this.rebuild = 0;
  }
  update(dt) {
    const s = this.stats;
    // Hangar rebuilds lost interceptors over time.
    const total = this.docked + this.wing.filter(i => !i.dead).length;
    if (total < s.interceptors) { this.rebuild += dt; if (this.rebuild >= s.rebuildTime) { this.rebuild = 0; this.docked++; } }
    this.wing = this.wing.filter(i => !i.dead);
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
  constructor(game, carrier) {
    super(game, 'interceptor', carrier.team, carrier.x, carrier.y);
    this.carrier = carrier; this.phase = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this.cool -= dt; this.phase += dt * 3;
    const c = this.carrier, leash = c.stats.leashRange * TILE;
    const t = this.target;
    if (c.dead) { this.damage(9999, null, true); return; }
    if (t && !t.dead && c.dist(t) < leash) {
      // Strafe around the target.
      const ox = t.x + Math.cos(this.phase) * 30, oy = t.y + Math.sin(this.phase) * 30;
      this.moveToward(ox, oy, dt, 2); this.tryFire(t, dt);
    } else {
      this.target = null;
      if (this.moveToward(c.x, c.y, dt, 8)) { this.dead = true; c.docked++; this.game.removeQuiet(this); } // re-dock
    }
  }
}
