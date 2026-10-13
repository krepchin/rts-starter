import { Entity } from './entity.js?v=9.2.2';
import { UNITS, TILE } from '../data/stats.js?v=9.2.2';

// Orders: {type:'move',x,y} | {type:'attack',target} | {type:'attackMove',x,y} | {type:'harvest'} | idle (null)
export class Unit extends Entity {
  constructor(game, type, team, x, y) {
    super(game, 'unit', type, team, x, y, UNITS[type]);
    this.order = null; this.angle = 0;
  }
  command(order) { if (this.dug && (order?.type === 'move' || order?.type === 'attackMove')) this.dug = false;
    this.order = order; this.target = null; if (order?.type === 'attackMove' || order?.type === 'move') this.anchor = null; }
  moveToward(x, y, dt, stopDist = 4) {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d <= stopDist) return true;
    if (this.dug) return false; // dug-in rockets can't move
    const step = Math.min(d, this.spd() * dt);
    this.x += dx / d * step; this.y += dy / d * step; this.angle = Math.atan2(dy, dx);
    return false;
  }
  spd() { return this.stats.speed * (this.stimT > 0 ? 1.6 : 1); }
  // ---- v9 infantry abilities (StarCraft-style). Returns true if used.
  //  stim (Rifleman): 6 s +60% speed and double fire rate, costs 10 HP. cloak (Sniper): 8 s untargetable.
  //  digin (Rocket): toggle; immobile, +1.5 range, half damage taken. engineer: capture / demo charge via orders.
  canUse() { const a = this.stats.ability; if (!a || a === 'engineer') return false; if (a === 'digin') return (this.abCd || 0) <= 0;
    return (this.abCd || 0) <= 0 && (a !== 'stim' || this.hp > 15); }
  useAbility() {
    if (!this.canUse()) return false; const a = this.stats.ability, g = this.game;
    if (a === 'stim') { this.stimT = 6; this.hp -= 10; this.abCd = 12; }
    else if (a === 'cloak') { this.cloakT = 8; this.cloaked = true; this.abCd = 25; }
    else if (a === 'digin') { this.dug = !this.dug; this.abCd = 1.2; if (this.dug) this.order = null; }
    if (this.team === 0) g.sfx?.(a); return true;
  }
  tickAbility(dt) {
    this.abCd = Math.max(0, (this.abCd || 0) - dt); this.fired = Math.max(0, (this.fired || 0) - dt);
    if (this.stimT > 0) this.stimT -= dt;
    if (this.cloakT > 0) { this.cloakT -= dt; if (this.cloakT <= 0) this.cloaked = false; }
  }
  // Engineer: move to an enemy building and capture it (engineer is used up) or plant a demo charge (5 s fuse, 600 dmg).
  // Idle engineers repair nearby damaged own buildings and vehicles for free.
  engineerUpdate(dt) {
    const o = this.order, g = this.game;
    if (o?.type === 'capture' || o?.type === 'demo') {
      const b = o.target; if (!b || b.dead || b.team === this.team || b.packing) { this.order = null; return true; }
      if (this.dist(b) > b.radius + 10) { this.moveToward(b.x, b.y, dt, 2); return true; }
      if (o.type === 'capture') {
        b.team = this.team; b.repairing = false; b.rally = null; b.seen = true; g.removeQuiet(this);
        g.effects.push({ t: 0.8, sell: true, x: b.x, y: b.y, r: b.radius }); if (this.team === 0 || b.team === 0) g.sfx?.('capture');
      } else { g.charges.push({ b, t: 5, team: this.team }); this.order = null; this.abCd = 15; if (this.team === 0) g.sfx?.('demo');
        this.command({ type: 'move', x: this.x + (this.x - b.x) * 0.8, y: this.y + (this.y - b.y) * 0.8 }); }
      return true;
    }
    if (o?.type === 'repair') { // v9.2: field repair of a targeted own vehicle (or building)
      const v = o.target; if (!v || v.dead || v.team !== this.team || v.hp >= v.stats.hp) { this.order = null; this.repairing = null; return true; }
      if (this.dist(v) > v.radius + 14) { this.moveToward(v.x, v.y, dt, v.radius + 8); this.repairing = null; return true; }
      v.hp = Math.min(v.stats.hp, v.hp + this.stats.repair * 1.5 * dt); this.repairing = v; v.beingRepaired = 0.3; return true;
    }
    if (!o) { // auto-repair
      let best = null, bd = 2.5 * TILE;
      for (const e of [...g.buildings, ...g.units]) if (e.team === this.team && !e.dead && e !== this && e.hp < e.stats.hp && !e.stats.inf && !e.isAir) { const d = this.dist(e) - e.radius; if (d < bd) { bd = d; best = e; } }
      if (best) { best.hp = Math.min(best.stats.hp, best.hp + this.stats.repair * dt); this.repairing = best; } else this.repairing = null;
    } else this.repairing = null;
    return false;
  }
  // v9.2 Medic: heals a targeted (or the most hurt nearby) friendly infantryman; follows a heal order to its target.
  medicUpdate(dt) {
    const o = this.order, s = this.stats, R = s.healRange * TILE;
    let p = o?.type === 'heal' ? o.target : null;
    if (p && (p.dead || p.team !== this.team || p.hp >= p.stats.hp)) { this.order = null; p = null; }
    if (p && this.dist(p) > R) { this.moveToward(p.x, p.y, dt, R * 0.6); this.healing = null; return true; }
    if (!p && (!o || o.type === 'attackMove')) { let bd = R * (o ? 1 : 1.6), best = null;
      for (const u of this.game.units) if (u.team === this.team && u.stats.inf && !u.dead && u !== this && u.hp < u.stats.hp) { const d = this.dist(u) - (u.stats.hp - u.hp) * 0.2; if (d < bd) { bd = d; best = u; } }
      p = best; if (p && this.dist(p) > R) { this.moveToward(p.x, p.y, dt, R * 0.6); this.healing = null; return true; } }
    if (!p && o?.type === 'attackMove' && this.moveToward(o.x, o.y, dt)) this.order = null;
    if (!p && this.hp < s.hp) p = this; // self-heal slowly when nobody else needs it
    this.healing = p && p !== this ? p : null;
    if (p) p.hp = Math.min(p.stats.hp, p.hp + s.heal * (p === this ? 0.4 : 1) * dt);
    return o?.type === 'heal';
  }
  update(dt) {
    this.cool -= dt; this.tickAbility(dt); if (this.beingRepaired > 0) this.beingRepaired -= dt;
    if (this.type === 'medic' && this.medicUpdate(dt)) { this.separate(dt); return; }
    if (this.type === 'engineer' && this.engineerUpdate(dt)) { this.separate(dt); return; }
    const o = this.order;
    if (o?.type === 'move') { if (this.moveToward(o.x, o.y, dt)) { this.order = null; this.anchor = { x: this.x, y: this.y }; } }
    else if (o?.type === 'attack') { // explicit attack order: pursue (player intent), then idle where it ended
      if (!this.canHit(o.target)) { this.order = null; this.anchor = { x: this.x, y: this.y }; }
      else if (!this.tryFire(o.target, dt)) this.moveToward(o.target.x, o.target.y, dt);
    } else if (this.stats.weapon) {
      // Idle / attack-move: auto-acquire enemies within sight, but only pursue within a leash of the unit's anchor
      // (its guard spot, or where an attack-move fight started). Afterwards return to the anchor instead of drifting off.
      if (!this.anchor) this.anchor = { x: this.x, y: this.y };
      const leash = this.stats.sight * TILE * 1.5, A = this.anchor, inLeash = e => Math.hypot(e.x - A.x, e.y - A.y) <= leash;
      if (!this.target || !this.canHit(this.target) || !inLeash(this.target))
        this.target = this.game.findEnemyNear(this, this.stats.sight * TILE, e => this.canHit(e) && inLeash(e));
      if (this.target) { if (!this.tryFire(this.target, dt)) this.moveToward(this.target.x, this.target.y, dt); }
      else if (o?.type === 'attackMove') { this.anchor = { x: this.x, y: this.y }; if (this.moveToward(o.x, o.y, dt)) this.order = null; }
      else if (Math.hypot(this.x - A.x, this.y - A.y) > 8) this.moveToward(A.x, A.y, dt, 8);
    }
    this.separate(dt);
    this.x = Math.max(0, Math.min(this.game.map.pxW, this.x)); this.y = Math.max(0, Math.min(this.game.map.pxH, this.y));
  }
  // Cheap local avoidance so units don't stack perfectly (no real pathfinding yet).
  separate(dt) {
    for (const o of this.game.units) {
      // Interceptors neither push nor get pushed: they swarm around/into their Carrier, and pushing it made Carriers
      // get shoved across (and off) the map while their wing chased them to re-dock.
      if (o === this || o.isAir !== this.isAir || o.dead || o.type === 'interceptor' || this.type === 'interceptor') continue;
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = this.radius + o.radius;
      if (d < min) { const push = (min - d) * 0.5 * Math.min(1, dt * 10); this.x += dx / d * push; this.y += dy / d * push; }
    }
    if (!this.isAir) for (const b of this.game.buildings) {
      if (b.dead || !b.contains(this.x, this.y) || (b.stats.gate && b.team === this.team && b.openK > 0.5)) continue;
      if (b.stats.wall || b.stats.gate) { // walls / closed gates are solid: snap out through the nearest edge
        const L = b.tx * TILE, T = b.ty * TILE, Rr = L + b.w * TILE, B = T + b.h * TILE, m = 0.5;
        const opts = [[this.x - L, L - m, null], [Rr - this.x, Rr + m, null], [this.y - T, null, T - m], [B - this.y, null, B + m]].sort((a, c) => a[0] - c[0]);
        if (opts[0][1] !== null) this.x = opts[0][1]; else this.y = opts[0][2]; this.blocked = (this.blocked || 0) + dt; continue; }
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
