import { Unit } from './unit.js?v=10.1';
import { TILE } from '../data/stats.js?v=10.1';

// v9.1 Dropship: cloaking tilt-rotor transport (StarCraft-style). 8 cargo slots: infantry 1, vehicles 4; the walker / yard
// crawler, harvesters and aircraft can't board. Units with a {type:'board', target: ds} order walk to it and get stored.
// Unload: fly to the point, then drop one unit every 0.45 s. Cloak drains energy; it breaks on unload and when the energy
// runs out. Cloaked units can be revealed by enemy turrets / Comm Centers within detectRange (see Game.updateDetection).
export const SLOT = u => u.stats.inf ? 1 : 4;
export const CAN_BOARD = u => !u.isAir && !u.carried && u.type !== 'harvester' && !u.carrier && !u.stats.hatchling;
export class Dropship extends Unit {
  constructor(game, team, x, y) { super(game, 'dropship', team, x, y); this.cargo = []; this.energy = this.stats.energy; this.unloadT = 0; this.cloakCd = 0; this.hum = 0; }
  get used() { return this.cargo.reduce((s, u) => s + SLOT(u), 0); }
  canTake(u) { return CAN_BOARD(u) && u.team === this.team && this.used + SLOT(u) <= this.stats.capacity; }
  take(u) { if (!this.canTake(u)) return false; u.dead = true; u.quiet = true; u.inside = this; u.order = null; this.cargo.push(u); this.game.sfx?.('board', this); return true; }
  loadNearby(r = 5) { let n = 0; for (const u of this.game.units) if (u.team === this.team && !u.dead && this.canTake(u) && this.dist(u) < r * TILE) { u.command({ type: 'board', target: this }); n++; } return n; }
  unloadAt(x, y) { if (!this.cargo.length) return false; this.order = { type: 'unload', x, y }; return true; }
  canCloak() { return !this.cloaked && this.cloakCd <= 0 && this.energy > 20; }
  setCloak(on) {
    if (on && this.canCloak()) { this.cloaked = true; this.game.sfx?.('cloak', this); return true; }
    if (!on && this.cloaked) { this.cloaked = false; this.cloakCd = this.stats.cloakCd; this.game.sfx?.('decloak', this); return true; }
    return false;
  }
  canUse() { return this.cloaked || this.canCloak(); }
  useAbility() { return this.setCloak(!this.cloaked); }
  update(dt) {
    const s = this.stats; this.cloakCd = Math.max(0, this.cloakCd - dt); this.hum += dt;
    if (this.cloaked) { this.energy -= s.cloakDrain * dt; if (this.energy <= 0) { this.energy = 0; this.setCloak(false); } }
    else this.energy = Math.min(s.energy, this.energy + s.energyRegen * dt);
    const o = this.order;
    if (o?.type === 'move' && this.moveToward(o.x, o.y, dt)) this.order = null;
    else if (o?.type === 'attackMove' && this.moveToward(o.x, o.y, dt)) this.order = null;
    else if (o?.type === 'unload') {
      if (Math.hypot(this.x - o.x, this.y - o.y) > 10) { this.moveToward(o.x, o.y, dt); this.unloadT = 0; }
      else {
        if (this.cloaked) this.setCloak(false); // unloading reveals the ship
        this.unloadT += dt; this.unloading = true;
        if (this.unloadT >= s.unloadEach) { this.unloadT = 0; const u = this.cargo.shift();
          if (u) { const k = this.cargo.length, a = k * 2.1; u.dead = false; u.quiet = false; u.inside = null; u.x = this.x + Math.cos(a) * (18 + k * 3); u.y = this.y + 20 + Math.sin(a) * 12;
            u.order = null; u.anchor = { x: u.x, y: u.y }; u.target = null; this.game.units.push(u); this.game.effects.push({ t: 0.5, dustRing: true, x: u.x, y: u.y, r: 14 }); this.game.sfx?.('drop', this); }
          if (!this.cargo.length) { this.order = null; this.unloading = false; } }
      }
    } else this.unloading = false;
    this.separate(dt);
    this.x = Math.max(0, Math.min(this.game.map.pxW, this.x)); this.y = Math.max(0, Math.min(this.game.map.pxH, this.y));
  }
  damage(n, src, raw) { const before = this.hp; super.damage(n, src, raw); if (this.hp <= 0 && before > 0) for (const u of this.cargo) { u.inside = null; } }
}
