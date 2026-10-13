import { TILE } from '../data/stats.js?v=10.2p';
let nextId = 1;
export function resetIds() { nextId = 1; } // multiplayer: both peers must number entities identically
export class Entity {
  constructor(game, kind, type, team, x, y, stats) {
    this.id = nextId++; this.game = game; this.kind = kind; this.type = type; this.team = team;
    this.x = x; this.y = y; this.stats = stats; this.hp = stats.hp; this.dead = false; this.cool = 0;
  }
  get radius() { return this.stats.radius ?? 16; }
  get isAir() { return !!this.stats.air; }
  dist(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  damage(n, src, force) {
    if (this.dead || (!force && !this.game.combat)) return; if (this.dug) n *= 0.5; if (this.hardT > 0) n *= 0.5; if (this.shieldT > 0) n *= 0.4; this.hp -= n; this.hitT = 0; this.lastAttacker = src;
    if (this.team === this.game.me && src && src.team !== this.game.me && n > 0) this.game.sfx?.(this.kind === 'building' ? 'alert:base' : 'alert:unit', this);
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
      const ts = target.stats, veh = target.kind === 'unit' && !ts.inf, mult = (ts.wall || ts.gate) ? (w.vsWall ?? 0.5) : ts.inf ? (w.vsInf ?? 1) : veh ? (w.vsVeh ?? w.vsOther ?? 1) : (w.vsOther ?? 1);
      target.damage(w.damage * mult, this); this.fired = 0.12;
      if (w.chain) { let last = target; for (let i = 0; i < w.chain; i++) { // Spark Drone lightning arcs to nearby enemies (50%)
        let n = null, bd = 1.6 * TILE; for (const e of this.game.units) { if (e === target || e === last || e.chained === this.cool || !this.canHit(e)) continue; const d = Math.hypot(e.x - last.x, e.y - last.y); if (d < bd) { bd = d; n = e; } } if (!n) break; n.chained = this.cool;
        n.damage(w.damage * 0.5, this); this.game.effects.push({ t: 0.18, x1: last.x, y1: last.y - 6, x2: n.x, y2: n.y - 6, fx: 'lightning', color: w.color }); last = n; } }
      this.game.effects.push({ t: w.bolt || w.rocket ? 0.25 : 0.12, x1: this.x, y1: this.y - (this.kind === 'building' ? 14 : 0), x2: target.x, y2: target.y, color: w.color, bolt: w.bolt, rocket: w.rocket, fx: w.fx, hover: !!this.stats.hover });
      if (this.team === this.game.me || target.team === this.game.me) this.game.sfx?.(w.bolt ? 'bolt' : w.rocket ? 'rocket' : this.type === 'sniper' ? 'snipe' : w.sound || (w.fx ? 'fx_' + w.fx : this.type === 'tank' ? 'cannon' : this.stats.inf ? 'rifle' : 'shot'), this);
      if (w.rocket && this.game.fxRocket) this.game.fxRocket(this, target);
    }
    return true;
  }
  canHit(t) { const w = this.stats.weapon; return w && this.game.combat && !t.dead && !t.under && (!t.cloaked || t.detected) && !(t.hiddenFrom && t.hiddenFrom(this)) && t.team !== this.team && (!t.isAir || w.air); }
}
