let nextId = 1;
export class Entity {
  constructor(game, kind, type, team, x, y, stats) {
    this.id = nextId++; this.game = game; this.kind = kind; this.type = type; this.team = team;
    this.x = x; this.y = y; this.stats = stats; this.hp = stats.hp; this.dead = false; this.cool = 0;
  }
  get radius() { return this.stats.radius ?? 16; }
  get isAir() { return !!this.stats.air; }
  dist(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  damage(n, src, force) {
    if (this.dead || (!force && !this.game.combat)) return; if (this.dug) n *= 0.5; this.hp -= n; this.lastAttacker = src;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.onDeath(this); }
  }
  // Shared weapon logic: fire at target if in range and off cooldown.
  tryFire(target, dt) {
    const w = this.stats.weapon; if (!w || !target || target.dead || !this.game.combat) return false;
    if (target.isAir && !w.air) return false;
    const range = (w.range + (this.dug ? 1.5 : 0)) * 32 + target.radius;
    if (this.dist(target) > range) return false;
    if (this.cool <= 0) {
      this.cool = w.cooldown * (this.stimT > 0 ? 0.5 : 1);
      const ts = target.stats, veh = target.kind === 'unit' && !ts.inf, mult = ts.inf ? (w.vsInf ?? 1) : veh ? (w.vsVeh ?? w.vsOther ?? 1) : (w.vsOther ?? 1);
      target.damage(w.damage * mult, this); this.fired = 0.12;
      this.game.effects.push({ t: w.bolt || w.rocket ? 0.25 : 0.12, x1: this.x, y1: this.y - (this.kind === 'building' ? 14 : 0), x2: target.x, y2: target.y, color: w.color, bolt: w.bolt, rocket: w.rocket });
      if (this.team === 0 || target.team === 0) this.game.sfx?.(w.bolt ? 'bolt' : w.rocket ? 'rocket' : this.type === 'sniper' ? 'snipe' : 'shot');
    }
    return true;
  }
  canHit(t) { const w = this.stats.weapon; return w && this.game.combat && !t.dead && !t.under && !t.cloaked && t.team !== this.team && (!t.isAir || w.air); }
}
