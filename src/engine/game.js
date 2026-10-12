import { TILE, BUILDINGS, UNITS, ECONOMY } from '../data/stats.js';
import { GameMap } from '../world/map.js';
import { Fog } from '../world/fog.js';
import { Building } from '../entities/building.js';
import { Unit, Harvester } from '../entities/unit.js';
import { Carrier, Interceptor } from '../entities/carrier.js';
import { MobileBase, FORMATION } from '../entities/mcv.js';
export const MORPH_TIME = { pack: 2.5, transform: 4 };

const UNIT_CLASSES = { harvester: Harvester, carrier: Carrier };
export const CATS = ['building', 'infantry', 'vehicle', 'aircraft'];
export const GRACE_SECONDS = 600; // optional ceasefire at game start (applies to both sides)
export const PRODUCER = { building: 'cy', infantry: 'barracks', vehicle: 'factory', aircraft: 'airfield' };

// Holds all simulation state. Rendering/UI read from it; input/AI write commands to it.
export class Game {
  constructor(opts = {}) {
    this.map = new GameMap(88, 88);
    this.graceUntil = opts.grace ? GRACE_SECONDS : 0;
    this.units = []; this.buildings = []; this.effects = []; this.morphs = [];
    this.teams = [0, 1].map(id => ({ id, credits: ECONOMY.startCredits, powerMade: 0, powerUsed: 0, lowPower: false, radar: false,
      queues: { building: [], infantry: [], vehicle: [], aircraft: [] }, paused: {}, stalled: {}, rr: {}, readyBuilding: null }));
    this.fog = new Fog(this.map, 0);
    this.over = null; this.winner = null; this.time = 0;
    this.setupSkirmish();
  }
  setupSkirmish() {
    const m = this.map;
    // Fields mirrored through the map centre so both bases get the same economy.
    for (const [x, y, r] of [[14, 20, 4], [20, 8, 3], [30, 58, 3], [12, 72, 4]]) { m.addField(x, y, r); m.addField(87 - x, 87 - y, r); }
    m.addField(44, 44, 5);
    this.addBuilding('cy', 0, 6, 6).age = 9; this.spawnUnit('harvester', 0, 10 * TILE, 12 * TILE);
    this.spawnUnit('tank', 0, 11 * TILE, 10 * TILE); this.spawnUnit('infantry', 0, 9 * TILE, 10 * TILE); this.spawnUnit('infantry', 0, 9.5 * TILE, 10.5 * TILE);
    this.addBuilding('cy', 1, 79, 79).age = 9; this.spawnUnit('harvester', 1, 79 * TILE, 77 * TILE);
    this.spawnUnit('tank', 1, 78 * TILE, 78 * TILE);
  }
  // ---- entity management
  addBuilding(type, team, tx, ty) {
    const b = new Building(this, type, team, tx, ty); this.buildings.push(b);
    if (b.stats.freeUnit) { const p = b.spawnPoint(); this.spawnUnit(b.stats.freeUnit, team, p.x, p.y); }
    return b;
  }
  spawnUnit(type, team, x, y) {
    const C = UNIT_CLASSES[type] || Unit; const u = new C(this, ...(C === Unit ? [type, team, x, y] : [team, x, y]));
    this.units.push(u); return u;
  }
  spawnInterceptor(carrier) { const i = new Interceptor(this, carrier); this.units.push(i); return i; }
  removeQuiet(e) { e.dead = true; e.quiet = true; }
  onDeath(e) { if (!e.quiet) this.effects.push({ t: 0.6, boom: true, x: e.x, y: e.y, r: e.radius * 1.6 }); }
  // ---- queries
  get entities() { return [...this.buildings, ...this.units]; }
  findEnemyNear(src, range, filter) {
    let best = null, bd = range;
    for (const e of this.units) if (e.team !== src.team && !e.dead && filter(e)) { const d = src.dist(e) - e.radius; if (d < bd) { bd = d; best = e; } }
    if (!best) for (const e of this.buildings) if (e.team !== src.team && !e.dead && filter(e)) { const d = src.dist(e) - e.radius; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  nearestOwn(src, type) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) if (b.team === src.team && b.type === type && !b.dead) { const d = src.dist(b); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  get combat() { return this.time >= this.graceUntil; } // false during the ceasefire: no damage, targeting, attacks or Ion
  graceLeft() { return Math.max(0, this.graceUntil - this.time); }
  has(team, type) { return this.buildings.some(b => b.team === team && b.type === type && !b.dead && !b.packing); }
  producers(team, cat) { return this.buildings.filter(b => b.team === team && !b.dead && !b.packing && b.type === PRODUCER[cat]); }
  entityAt(px, py) {
    for (let i = this.units.length - 1; i >= 0; i--) { const u = this.units[i]; if (!u.dead && Math.hypot(u.x - px, u.y - py) <= u.radius + 4) return u; }
    return this.buildings.find(b => !b.dead && b.contains(px, py)) || null;
  }
  addCredits(team, n) { this.teams[team].credits += n; }
  // ---- production queues (C&C style: cost drains while building; stalls when broke; cancel refunds what was paid)
  catOf(key, isB) { return isB ? 'building' : UNITS[key].from; }
  canProduce(team, key, isB) {
    const s = isB ? BUILDINGS[key] : UNITS[key];
    if (!s || s.buildable === false) return false;
    return this.has(team, PRODUCER[this.catOf(key, isB)]) && (s.req || []).every(r => this.has(team, r));
  }
  queued(team, key, isB) { return this.teams[team].queues[this.catOf(key, isB)].filter(q => q.key === key).length; }
  enqueue(team, key, isB) {
    const t = this.teams[team], q = t.queues[this.catOf(key, isB)], s = isB ? BUILDINGS[key] : UNITS[key];
    if (!this.canProduce(team, key, isB)) return false;
    if (isB ? (q.length || t.readyBuilding) : q.length >= ECONOMY.queueMax) return false;
    q.push({ key, isB, progress: 0, time: s.time, cost: s.cost, paid: 0 }); if (team === 0) this.sfx?.('queue'); return true;
  }
  startProduction(team, key, isB) { return this.enqueue(team, key, isB); } // backwards-compatible alias
  // Cancel the last queued item of `key` (or the last item in the category). Refunds what was paid.
  cancel(team, cat, key) {
    const t = this.teams[team];
    if (cat === 'building' && t.readyBuilding && (!key || key === t.readyBuilding)) { t.credits += BUILDINGS[t.readyBuilding].cost; t.readyBuilding = null; return true; }
    const q = t.queues[cat]; let i = q.length - 1; if (key) while (i >= 0 && q[i].key !== key) i--;
    if (i < 0) return false;
    t.credits += q[i].paid; q.splice(i, 1); if (!q.length) t.paused[cat] = false; return true;
  }
  cancelProduction(team, cat) { return this.cancel(team, cat); }
  togglePause(team, cat) { const t = this.teams[team]; t.paused[cat] = !t.paused[cat] && t.queues[cat].length > 0; return t.paused[cat]; }
  canPlace(team, type, tx, ty) {
    const s = BUILDINGS[type];
    if (!this.has(team, 'cy')) return false;
    if (tx < 0 || ty < 0 || tx + s.w > this.map.w || ty + s.h > this.map.h) return false;
    for (const b of this.buildings) if (!b.dead && tx < b.tx + b.w && tx + s.w > b.tx && ty < b.ty + b.h && ty + s.h > b.ty) return false;
    for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) if (this.map.tib[this.map.idx(x, y)] > 0) return false;
    // Build radius follows the deployed Construction Yard(s): within 12 tiles of a yard, and next to an own building.
    const cx = (tx + s.w / 2) * TILE, cy = (ty + s.h / 2) * TILE;
    if (!this.buildings.some(b => !b.dead && !b.packing && b.team === team && b.type === 'cy' && Math.hypot(b.x - cx, b.y - cy) <= 12 * TILE)) return false;
    return this.buildings.some(b => !b.dead && b.team === team && Math.abs(b.x - (tx + s.w / 2) * TILE) < (b.w / 2 + s.w / 2 + 5) * TILE && Math.abs(b.y - (ty + s.h / 2) * TILE) < (b.h / 2 + s.h / 2 + 5) * TILE);
  }
  placeBuilding(team, tx, ty) {
    const t = this.teams[team]; if (!t.readyBuilding || !this.canPlace(team, t.readyBuilding, tx, ty)) return false;
    this.addBuilding(t.readyBuilding, team, tx, ty); t.readyBuilding = null; if (team === 0) this.sfx?.('build'); return true;
  }
  // ---- building abilities
  sell(team, b) {
    if (!b || b.dead || b.team !== team || b.kind !== 'building') return 0;
    const refund = Math.floor((b.stats.cost || 0) * ECONOMY.sellRefund * b.hp / b.stats.hp);
    this.teams[team].credits += refund;
    const survivors = Math.min(3, Math.floor(b.w * b.h / 3));
    for (let i = 0; i < survivors; i++) this.spawnUnit('infantry', team, b.x + (i - 1) * 12, (b.ty + b.h) * TILE + 8);
    this.removeQuiet(b); this.effects.push({ t: 0.8, sell: true, x: b.x, y: b.y, r: b.radius });
    return refund;
  }
  toggleRepair(team, b) { if (b && !b.dead && b.team === team && b.kind === 'building') b.repairing = !b.repairing && b.hp < b.stats.hp; return b?.repairing; }
  superReady(team) { return this.buildings.find(b => b.team === team && !b.dead && b.stats.superweapon && b.powered && b.charge >= b.stats.superweapon.chargeTime) || null; }
  fireSuper(team, x, y) {
    const src = this.superReady(team); if (!src || !this.combat) return false;
    const sw = src.stats.superweapon, r = sw.radius * TILE; src.charge = 0;
    for (const e of this.entities) if (!e.dead && !e.under && Math.hypot(e.x - x, e.y - y) <= r + e.radius * 0.5) e.damage(sw.damage, src);
    this.effects.push({ t: 1.4, ion: true, x, y, r }); return true;
  }
  // ---- v8 mobile command centre
  // Pack alone: the yard folds into a slow armored crawler. Transform base: yard + nearest barracks, one power plant and
  // the war factory (within 10 tiles) slide together into the Base Walker. While packing/packed nothing builds and the
  // carried power plant is offline.
  canMorph(team, cy) { return !!cy && !cy.dead && cy.team === team && cy.type === 'cy' && !cy.packing && cy.age > 1.5; }
  transformParts(cy) {
    const parts = [cy];
    for (const type of ['barracks', 'power', 'factory']) {
      let best = null, bd = 10 * TILE;
      for (const b of this.buildings) if (b.team === cy.team && b.type === type && !b.dead && !b.packing) { const d = b.dist(cy); if (d < bd) { bd = d; best = b; } }
      if (best) parts.push(best);
    }
    return parts;
  }
  packYard(team, cy) { return this.startMorph(team, cy, 'pack'); }
  transformBase(team, cy) { return this.startMorph(team, cy, 'transform'); }
  startMorph(team, cy, mode) {
    if (!this.canMorph(team, cy)) return false;
    const parts = mode === 'pack' ? [cy] : this.transformParts(cy);
    for (const b of parts) { b.packing = true; b.repairing = false; b.slide = { dx: cy.x - b.x, dy: cy.y - b.y, k: 0 }; }
    this.morphs.push({ team, cy, mode, parts, t: 0, dur: MORPH_TIME[mode] }); if (team === 0) this.sfx?.('transform'); return true;
  }
  updateMorphs(dt) {
    for (const m of this.morphs) {
      m.t += dt; const p = Math.min(1, m.t / (m.dur * 0.8));
      if (m.cy.dead) { for (const b of m.parts) { b.packing = false; b.slide = null; } m.done = true; continue; } // yard destroyed mid-pack
      m.parts = m.parts.filter(b => !b.dead);
      for (const b of m.parts) { b.slide.k = p * p * (3 - 2 * p);
        if (Math.random() < dt * 10 && this.effects.length < 700) this.effects.push({ part: true, x: b.x + b.slide.dx * b.slide.k + (Math.random() - .5) * b.w * TILE, y: b.y + b.slide.dy * b.slide.k + b.h * TILE / 2, vx: (Math.random() - .5) * 40, vy: -10, g: 0, size: 6, color: '#bfae8c', t: 0.9, life: 0.9 }); }
      if (m.t < m.dur) continue;
      m.done = true;
      const carried = m.parts.map(b => ({ type: b.type, hpFrac: b.hp / b.stats.hp }));
      for (const b of m.parts) this.removeQuiet(b);
      const u = new MobileBase(this, m.mode === 'pack' ? 'mcv' : 'robot', m.team, m.cy.x, m.cy.y + TILE, carried);
      this.units.push(u); m.cy.becameUnit = u;
      this.effects.push({ t: 0.6, sell: true, x: u.x, y: u.y, r: 50 });
    }
    this.morphs = this.morphs.filter(m => !m.done);
  }
  fits(team, type, tx, ty, ignore) {
    const s = BUILDINGS[type];
    if (tx < 0 || ty < 0 || tx + s.w > this.map.w || ty + s.h > this.map.h) return false;
    for (const b of this.buildings) if (!b.dead && tx < b.tx + b.w && tx + s.w > b.tx && ty < b.ty + b.h && ty + s.h > b.ty) return false;
    for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) if (this.map.tib[this.map.idx(x, y)] > 0) return false;
    return true;
  }
  // tx,ty = where the yard's top-left tile goes; the rest of the carried base unfolds around it (FORMATION).
  canDeploy(mb, tx, ty) { return mb.footprint().every(f => this.fits(mb.team, f.type, tx + f.dx, ty + f.dy)); }
  finishDeploy(mb) {
    const { tx, ty } = mb.deployAt; if (!this.canDeploy(mb, tx, ty)) return false;
    const frac = mb.hp / mb.stats.hp; let cy = null;
    for (const c of mb.carried) {
      const [dx, dy] = FORMATION[c.type], b = new Building(this, c.type, mb.team, tx + dx, ty + dy);
      b.hp = Math.max(1, b.stats.hp * frac); b.age = 9; b.unfold = { fx: mb.x - b.x, fy: mb.y - 20 - b.y, t: 1.2, dur: 1.2 };
      this.buildings.push(b); if (c.type === 'cy') cy = b;
    }
    this.removeQuiet(mb); mb.becameBuilding = cy; if (mb.team === 0) this.sfx?.('build'); this.effects.push({ t: 0.8, sell: true, x: mb.x, y: mb.y, r: 70 });
    return true;
  }
  // ---- tick
  update(dt) {
    if (this.over) return;
    this.time += dt; this.map.update(dt); this.updateMorphs(dt);
    for (const t of this.teams) {
      t.powerMade = 0; t.powerUsed = 0;
      for (const b of this.buildings) if (b.team === t.id && !b.dead && !b.packing) { if (b.stats.power > 0) t.powerMade += b.stats.power; else t.powerUsed -= b.stats.power; }
      t.lowPower = t.powerUsed > t.powerMade;
      const pf = t.lowPower ? Math.max(ECONOMY.minPowerSpeed, t.powerMade / t.powerUsed) : 1;
      t.radar = !t.lowPower && this.has(t.id, 'radar');
      for (const cat of CATS) {
        const q = t.queues[cat]; t.stalled[cat] = null;
        if (!q.length || t.paused[cat]) continue;
        const prods = this.producers(t.id, cat);
        if (!prods.length) { t.stalled[cat] = cat === 'building' ? 'no Construction Yard' : 'no production building'; continue; }
        if (cat === 'building' && t.readyBuilding) continue;
        const it = q[0], speed = pf * (cat === 'building' ? 1 : 1 + ECONOMY.factoryBonus * (prods.length - 1));
        const dp = Math.min(dt * speed, it.time - it.progress), due = it.time ? it.cost * dp / it.time : it.cost - it.paid;
        if (due > 0) { if (t.credits < due) { t.stalled[cat] = 'insufficient funds'; continue; } t.credits -= due; it.paid += due; }
        it.progress += dp;
        if (it.progress >= it.time - 1e-6) {
          const rest = it.cost - it.paid; if (rest > 1e-6) { if (t.credits < rest) continue; t.credits -= rest; it.paid = it.cost; }
          q.shift();
          if (it.isB) t.readyBuilding = it.key;
          else {
            const p = prods[(t.rr[cat] = ((t.rr[cat] || 0) + 1) % prods.length)];
            const sp = p.spawnPoint(); const u = this.spawnUnit(it.key, t.id, sp.x + (Math.random() - .5) * 20, sp.y);
            if (p.rally) u.command(u.type === 'harvester' ? { type: 'harvest' } : { type: 'move', x: p.rally.x, y: p.rally.y });
          }
        }
      }
      // Repair drains credits while active.
      for (const b of this.buildings) if (b.team === t.id && b.repairing && !b.dead) {
        if (b.hp >= b.stats.hp) { b.repairing = false; continue; }
        const heal = Math.min(b.stats.hp - b.hp, b.stats.hp * ECONOMY.repairRate * dt), cost = heal / b.stats.hp * (b.stats.cost || 1000) * ECONOMY.repairCost;
        if (t.credits < cost) { b.repairing = false; continue; }
        t.credits -= cost; b.hp += heal;
      }
    }
    for (const b of this.buildings) if (!b.dead) b.update(dt);
    for (const u of this.units) if (!u.dead) {
      u.update(dt);
      // Safety net for every unit class (Carrier/Harvester have their own update): never leave the map, never NaN.
      if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) { u.x = u.lastX ?? this.map.pxW / 2; u.y = u.lastY ?? this.map.pxH / 2; }
      u.x = Math.max(4, Math.min(this.map.pxW - 4, u.x)); u.y = Math.max(4, Math.min(this.map.pxH - 4, u.y)); u.lastX = u.x; u.lastY = u.y;
    }
    this.units = this.units.filter(u => !u.dead); this.buildings = this.buildings.filter(b => !b.dead);
    for (const e of this.effects) { e.t -= dt; if (e.part) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.g || 0) * dt; e.vx *= 0.97; } }
    for (const b of this.buildings) if (b.unfold) { b.unfold.t -= dt; if (b.unfold.t <= 0) b.unfold = null; } this.effects = this.effects.filter(e => e.t > 0);
    this.fog.update(this.entities);
    for (const team of [0, 1]) if (!this.buildings.some(b => b.team === team) && !this.units.some(u => u.team === team && u.carried)) { this.over = team === 0 ? 'lose' : 'win'; this.winner = 1 - team; }
  }
}
