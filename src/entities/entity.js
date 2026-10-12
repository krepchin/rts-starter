let nextId = 1;
export class Entity {
  constructor(game, kind, type, team, x, y, stats) {
    this.id = nextId++; this.game = game; this.kind = kind; this.type = type; this.team = team;
    this.x = x; this.y = y; this.stats = stats; this.hp = stats.hp; this.dead = false; this.cool = 0;
  }
  get radius() { return this.stats.radius ?? 16; }
  get isAir() { return !!this.stats.air; }
  dist(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  damage(n, src) {
    if (this.dead) return; this.hp -= n; this.lastAttacker = src;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.onDeath(this); }
  }
  // Shared weapon logic: fire at target if in range and off cooldown.
  tryFire(target, dt) {
    const w = this.stats.weapon; if (!w || !target || target.dead) return false;
    if (target.isAir && !w.air) return false;
    const range = w.range * 32 + target.radius;
    if (this.dist(target) > range) return false;
    if (this.cool <= 0) { this.cool = w.cooldown; target.damage(w.damage, this);
      this.game.effects.push({ t: 0.12, x1: this.x, y1: this.y, x2: target.x, y2: target.y, color: w.color }); }
    return true;
  }
  canHit(t) { const w = this.stats.weapon; return w && !t.dead && t.team !== this.team && (!t.isAir || w.air); }
}
