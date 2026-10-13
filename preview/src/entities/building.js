import { Entity } from './entity.js?v=10.2p2';
import { BUILDINGS, TILE } from '../data/stats.js?v=10.2p2';

export class Building extends Entity {
  toggleLock() { this.locked = !this.locked; return true; } // v10: a method so multiplayer can network it
  constructor(game, type, team, tx, ty) {
    const s = BUILDINGS[type];
    super(game, 'building', type, team, (tx + s.w / 2) * TILE, (ty + s.h / 2) * TILE, s);
    this.tx = tx; this.ty = ty; this.w = s.w; this.h = s.h;
    this.age = 0; this.charge = 0; this.aim = game.teams?.[team]?.startLeft === false ? Math.PI : game.teams?.[team]?.startLeft ? 0 : Math.PI / 2; this.flash = 0; this.repairing = false; this.powered = true;
  }
  // v9.2: buildings face the enemy - a team that started on the left faces right, and vice versa (captures follow the new owner).
  get faceRight() { return !!this.game?.teams?.[this.team]?.startLeft; }
  get radius() { return Math.max(this.w, this.h) * TILE / 2; }
  // Where produced units appear / harvesters dock.
  spawnPoint() { return { x: this.x, y: (this.ty + this.h) * TILE + 14 }; }
  contains(px, py) { return px >= this.tx * TILE && py >= this.ty * TILE && px < (this.tx + this.w) * TILE && py < (this.ty + this.h) * TILE; }
  update(dt) {
    this.cool -= dt; this.age += dt; this.flash -= dt; this.hitT = (this.hitT ?? 9) + dt;
    if (this.stats.organic && this.hitT > 6 && this.hp < this.stats.hp && this.age > 1) this.hp = Math.min(this.stats.hp, this.hp + this.stats.hp * 0.006 * dt); // organic regen
    if (this.stats.gate) { // opens for nearby friendly ground units unless locked; always closed to enemies
      const want = !this.locked && this.game.units.some(u => u.team === this.team && !u.dead && !u.isAir && Math.hypot(u.x - this.x, u.y - this.y) < 1.8 * TILE);
      this.openK = Math.max(0, Math.min(1, (this.openK || 0) + (want ? 2.5 : -2.5) * dt)); }
    this.powered = !this.game.teams[this.team].lowPower;
    const sw = this.stats.superweapon;
    if (sw && this.powered) this.charge = Math.min(sw.chargeTime, this.charge + dt);
    const rp = this.stats.repairs; this.fixing = null;
    if (rp && this.powered && !this.packing) { // Repair Center (vehicles) / Airfield (aircraft that make it home)
      const T = this.game.teams[this.team], reach = rp.reach * TILE;
      for (const u of this.game.units) {
        if (u.team !== this.team || u.dead || u.stats.inf || u.carried || !!u.carrier || u.hp >= u.stats.hp || !!u.isAir !== !!rp.air) continue;
        if (Math.abs(u.x - this.x) > this.w * TILE / 2 + reach || Math.abs(u.y - this.y) > this.h * TILE / 2 + reach) continue;
        const heal = Math.min(u.stats.hp - u.hp, rp.rate * dt), cost = heal / u.stats.hp * (u.stats.cost || 800) * 0.25;
        if (T.credits < cost) break; T.credits -= cost; u.hp += heal; u.beingRepaired = 0.3; this.fixing = u; }
    }
    const w = this.stats.weapon;
    if (w) {
      if (!this.powered) { this.target = null; return; } // defenses go offline on low power
      if (!this.target || !this.canHit(this.target) || !this.tryFire(this.target, dt))
        this.target = this.game.findEnemyNear(this, w.range * TILE, e => this.canHit(e));
      if (this.target) { this.aim = Math.atan2(this.target.y - this.y, this.target.x - this.x); if (this.cool >= w.cooldown - 1e-6) this.flash = 0.12; }
    }
  }
}
