import { Entity } from './entity.js';
import { BUILDINGS, TILE } from '../data/stats.js';

export class Building extends Entity {
  constructor(game, type, team, tx, ty) {
    const s = BUILDINGS[type];
    super(game, 'building', type, team, (tx + s.w / 2) * TILE, (ty + s.h / 2) * TILE, s);
    this.tx = tx; this.ty = ty; this.w = s.w; this.h = s.h;
  }
  get radius() { return Math.max(this.w, this.h) * TILE / 2; }
  // Where produced units appear.
  spawnPoint() { return { x: this.x, y: (this.ty + this.h) * TILE + 14 }; }
  contains(px, py) { return px >= this.tx * TILE && py >= this.ty * TILE && px < (this.tx + this.w) * TILE && py < (this.ty + this.h) * TILE; }
  update(dt) {
    this.cool -= dt;
    if (this.stats.weapon) {
      if (!this.target || !this.canHit(this.target) || !this.tryFire(this.target, dt))
        this.target = this.game.findEnemyNear(this, this.stats.weapon.range * TILE, e => this.canHit(e));
    }
  }
}
