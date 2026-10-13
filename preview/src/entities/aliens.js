import { Unit, Harvester } from './unit.js?v=10.2p2';
import { Jet } from './air.js?v=10.2p2';
import { TILE, UNITS } from '../data/stats.js?v=10.2p2';

// v10.1 Nordic + Grey special units.
export class FactionHarvester extends Harvester { constructor(game, team, x, y, type) { super(game, team, x, y, type); } }
export class Lightcraft extends Jet { constructor(game, team, x, y) { super(game, team, x, y); this.type = 'lightcraft'; this.stats = UNITS.lightcraft; this.hp = this.stats.hp; } }

// Abduction Saucer / Mothership: hovers over an enemy ground unit and lifts it in a tractor beam (channelled); a lifted unit is
// removed from the map and part of its cost is credited. Breaks off if the target leaves the beam. Also has a light zapper.
export class Saucer extends Unit {
  constructor(game, team, x, y, type = 'saucer') { super(game, type, team, x, y); this.beamT = 0; this.beam = null; }
  canAbduct(e) { const tr = this.stats.tractor; return e && !e.dead && e.team !== this.team && e.kind === 'unit' && !e.isAir && !e.carried && e.hp <= tr.maxHp && (!e.cloaked || e.detected); }
  update(dt) {
    this.cool -= dt; const g = this.game, o = this.order, tr = this.stats.tractor;
    let t = o?.type === 'attack' && o.target ? o.target : null;
    if (t && t.dead) { this.order = null; t = null; }
    if (!t && (!o || o.type === 'attackMove')) t = g.combat ? g.findEnemyNear(this, this.stats.sight * TILE, e => this.canAbduct(e)) : null;
    if (t && g.combat) {
      if (this.canAbduct(t)) {
        const d = Math.hypot(t.x - this.x, t.y - this.y);
        if (d > 10) { this.moveToward(t.x, t.y, dt, 6); this.beam = null; this.beamT = 0; }
        else { if (this.beam !== t) { this.beam = t; this.beamT = 0; } this.beamT += dt; t.stunT = Math.max(t.stunT || 0, 0.2); t.lift = Math.min(1, this.beamT / tr.time);
          if (this.beamT >= tr.time) { g.addCredits(this.team, Math.round((t.stats.cost || 200) * tr.reward)); g.effects.push({ t: 0.5, flash: true, x: t.x, y: t.y - 10, r: 16 }); g.removeQuiet(t); this.beam = null; this.beamT = 0; g.sfx?.('capture', this); if (o?.target === t) this.order = null; } }
      } else { this.beam = null; if (!this.tryFire(t, dt)) this.moveToward(t.x, t.y, dt, 20); }
    } else { this.beam = null; this.beamT = 0;
      if (o?.type === 'move' || o?.type === 'attackMove') { if (this.moveToward(o.x, o.y, dt)) this.order = null; } }
    if (!this.beam && g.combat) { const z = g.findEnemyNear(this, this.stats.weapon.range * TILE, e => this.canHit(e)); if (z) this.tryFire(z, dt); }
    this.separate(dt);
  }
}
