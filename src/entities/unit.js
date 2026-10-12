import { Entity } from './entity.js';
import { UNITS, TILE } from '../data/stats.js';

// Orders: {type:'move',x,y} | {type:'attack',target} | {type:'attackMove',x,y} | {type:'harvest'} | idle (null)
export class Unit extends Entity {
  constructor(game, type, team, x, y) {
    super(game, 'unit', type, team, x, y, UNITS[type]);
    this.order = null; this.angle = 0;
  }
  command(order) { this.order = order; this.target = null; }
  moveToward(x, y, dt, stopDist = 4) {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d <= stopDist) return true;
    const step = Math.min(d, this.stats.speed * dt);
    this.x += dx / d * step; this.y += dy / d * step; this.angle = Math.atan2(dy, dx);
    return false;
  }
  update(dt) {
    this.cool -= dt;
    const o = this.order;
    if (o?.type === 'move') { if (this.moveToward(o.x, o.y, dt)) this.order = null; }
    else if (o?.type === 'attack') {
      if (!this.canHit(o.target)) this.order = null;
      else if (!this.tryFire(o.target, dt)) this.moveToward(o.target.x, o.target.y, dt);
    } else if (this.stats.weapon) {
      // Idle / attack-move: auto-acquire enemies within sight.
      if (!this.target || !this.canHit(this.target) || this.dist(this.target) > this.stats.sight * TILE * 1.5)
        this.target = this.game.findEnemyNear(this, this.stats.sight * TILE, e => this.canHit(e));
      if (this.target) { if (!this.tryFire(this.target, dt)) this.moveToward(this.target.x, this.target.y, dt); }
      else if (o?.type === 'attackMove' && this.moveToward(o.x, o.y, dt)) this.order = null;
    }
    this.separate(dt);
    this.x = Math.max(0, Math.min(this.game.map.pxW, this.x)); this.y = Math.max(0, Math.min(this.game.map.pxH, this.y));
  }
  // Cheap local avoidance so units don't stack perfectly (no real pathfinding yet).
  separate(dt) {
    for (const o of this.game.units) {
      if (o === this || o.isAir !== this.isAir || o.dead) continue;
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = this.radius + o.radius;
      if (d < min) { const push = (min - d) * 0.5 * Math.min(1, dt * 10); this.x += dx / d * push; this.y += dy / d * push; }
    }
    if (!this.isAir) for (const b of this.game.buildings) {
      if (b.dead || !b.contains(this.x, this.y)) continue;
      const dx = this.x - b.x, dy = this.y - b.y, d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * 60 * dt; this.y += dy / d * 60 * dt;
    }
  }
}

export class Harvester extends Unit {
  constructor(game, team, x, y) { super(game, 'harvester', team, x, y); this.load = 0; this.order = { type: 'harvest' }; this.state = 'seek'; }
  update(dt) {
    if (this.order?.type !== 'harvest') { super.update(dt); if (!this.order) this.order = { type: 'harvest' }; return; }
    const s = this.stats, map = this.game.map;
    if (this.state === 'seek') {
      if (this.load >= s.capacity) { this.state = 'return'; return; }
      if (!this.field || map.tib[map.idx(this.field.tx, this.field.ty)] < 40) this.field = map.nearestTiberium(this.x, this.y);
      if (!this.field) { this.state = this.load > 0 ? 'return' : 'seek'; return; }
      const fx = (this.field.tx + 0.5) * TILE, fy = (this.field.ty + 0.5) * TILE;
      if (this.moveToward(fx, fy, dt, 6)) this.state = 'harvest';
    } else if (this.state === 'harvest') {
      this.load += map.harvest(this.field.tx, this.field.ty, s.harvestRate * dt);
      if (this.load >= s.capacity) this.state = 'return';
      else if (map.tib[map.idx(this.field.tx, this.field.ty)] < 1) { this.field = null; this.state = 'seek'; }
    } else if (this.state === 'return') {
      const ref = this.game.nearestOwn(this, 'refinery');
      if (!ref) return;
      const dock = ref.spawnPoint();
      if (this.moveToward(dock.x, dock.y, dt, 10) || this.dist(ref) < ref.radius + 22) { this.game.addCredits(this.team, Math.round(this.load)); this.load = 0; this.state = 'seek'; }
    }
    this.separate(dt);
  }
  command(order) { super.command(order); if (order?.type === 'harvest') this.state = 'seek'; }
}
