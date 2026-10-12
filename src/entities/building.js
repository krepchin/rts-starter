import { Entity } from './entity.js';
import { BUILDINGS, TILE } from '../data/stats.js';

export class Building extends Entity {
  constructor(game, type, team, tx, ty) {
    const s = BUILDINGS[type];
    super(game, 'building', type, team, (tx + s.w / 2) * TILE, (ty + s.h / 2) * TILE, s);
    this.tx = tx; this.ty = ty; this.w = s.w; this.h = s.h;
    this.age = 0; this.charge = 0; this.aim = Math.PI / 2; this.flash = 0; this.repairing = false; this.powered = true;
  }
  get radius() { return Math.max(this.w, this.h) * TILE / 2; }
  // Where produced units appear / harvesters dock.
  spawnPoint() { return { x: this.x, y: (this.ty + this.h) * TILE + 14 }; }
  contains(px, py) { return px >= this.tx * TILE && py >= this.ty * TILE && px < (this.tx + this.w) * TILE && py < (this.ty + this.h) * TILE; }
  update(dt) {
    this.cool -= dt; this.age += dt; this.flash -= dt;
    this.powered = !this.game.teams[this.team].lowPower;
    const sw = this.stats.superweapon;
    if (sw && this.powered) this.charge = Math.min(sw.chargeTime, this.charge + dt);
    const w = this.stats.weapon;
    if (w) {
      if (!this.powered) { this.target = null; return; } // defenses go offline on low power
      if (!this.target || !this.canHit(this.target) || !this.tryFire(this.target, dt))
        this.target = this.game.findEnemyNear(this, w.range * TILE, e => this.canHit(e));
      if (this.target) { this.aim = Math.atan2(this.target.y - this.y, this.target.x - this.x); if (this.cool >= w.cooldown - 1e-6) this.flash = 0.12; }
    }
  }
}
