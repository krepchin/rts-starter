import { TILE, BUILDINGS, UNITS, ECONOMY } from '../data/stats.js';
import { GameMap } from '../world/map.js';
import { Fog } from '../world/fog.js';
import { Building } from '../entities/building.js';
import { Unit, Harvester } from '../entities/unit.js';
import { Carrier, Interceptor } from '../entities/carrier.js';

const UNIT_CLASSES = { harvester: Harvester, carrier: Carrier };

// Holds all simulation state. Rendering/UI read from it; input/AI write commands to it.
export class Game {
  constructor() {
    this.map = new GameMap(64, 64);
    this.units = []; this.buildings = []; this.effects = [];
    this.teams = [0, 1].map(id => ({ id, credits: ECONOMY.startCredits, powerMade: 0, powerUsed: 0,
      queues: { building: null, infantry: null, vehicle: null, aircraft: null }, readyBuilding: null }));
    this.fog = new Fog(this.map, 0);
    this.over = null; this.time = 0;
    this.setupSkirmish();
  }
  setupSkirmish() {
    const m = this.map;
    m.addField(14, 20, 4); m.addField(20, 8, 3); m.addField(50, 44, 4); m.addField(44, 56, 3);
    m.addField(32, 32, 5); m.addField(10, 52, 3); m.addField(54, 12, 3);
    this.addBuilding('cy', 0, 6, 6); this.spawnUnit('harvester', 0, 10 * TILE, 12 * TILE);
    this.spawnUnit('tank', 0, 11 * TILE, 10 * TILE); this.spawnUnit('infantry', 0, 9 * TILE, 10 * TILE); this.spawnUnit('infantry', 0, 9.5 * TILE, 10.5 * TILE);
    this.addBuilding('cy', 1, 54, 54); this.spawnUnit('harvester', 1, 54 * TILE, 52 * TILE);
    this.spawnUnit('tank', 1, 53 * TILE, 53 * TILE);
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
  has(team, type) { return this.buildings.some(b => b.team === team && b.type === type && !b.dead); }
  entityAt(px, py) {
    for (let i = this.units.length - 1; i >= 0; i--) { const u = this.units[i]; if (!u.dead && Math.hypot(u.x - px, u.y - py) <= u.radius + 4) return u; }
    return this.buildings.find(b => !b.dead && b.contains(px, py)) || null;
  }
  addCredits(team, n) { this.teams[team].credits += n; }
  // ---- production (C&C style: one item per category at a time; cost paid up front)
  canProduce(team, key, isBuilding) {
    const s = isBuilding ? BUILDINGS[key] : UNITS[key];
    if (isBuilding) return this.has(team, 'cy') && (s.req || []).every(r => this.has(team, r));
    const producer = Object.keys(BUILDINGS).find(k => BUILDINGS[k].builds === s.from);
    return s.buildable !== false && this.has(team, producer);
  }
  startProduction(team, key, isBuilding) {
    const t = this.teams[team], s = isBuilding ? BUILDINGS[key] : UNITS[key];
    const cat = isBuilding ? 'building' : s.from;
    if (t.queues[cat] || (isBuilding && t.readyBuilding) || t.credits < s.cost || !this.canProduce(team, key, isBuilding)) return false;
    t.credits -= s.cost; t.queues[cat] = { key, isBuilding, progress: 0, time: s.time }; return true;
  }
  cancelProduction(team, cat) {
    const t = this.teams[team], q = t.queues[cat]; if (!q) return;
    t.credits += (q.isBuilding ? BUILDINGS : UNITS)[q.key].cost; t.queues[cat] = null;
  }
  canPlace(team, type, tx, ty) {
    const s = BUILDINGS[type];
    if (tx < 0 || ty < 0 || tx + s.w > this.map.w || ty + s.h > this.map.h) return false;
    for (const b of this.buildings) if (!b.dead && tx < b.tx + b.w + 0 && tx + s.w > b.tx && ty < b.ty + b.h && ty + s.h > b.ty) return false;
    for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) if (this.map.tib[this.map.idx(x, y)] > 0) return false;
    // Must be near an existing own building (C&C build radius).
    return this.buildings.some(b => !b.dead && b.team === team && Math.abs(b.x - (tx + s.w / 2) * TILE) < (b.w / 2 + s.w / 2 + 5) * TILE && Math.abs(b.y - (ty + s.h / 2) * TILE) < (b.h / 2 + s.h / 2 + 5) * TILE);
  }
  placeBuilding(team, tx, ty) {
    const t = this.teams[team]; if (!t.readyBuilding || !this.canPlace(team, t.readyBuilding, tx, ty)) return false;
    this.addBuilding(t.readyBuilding, team, tx, ty); t.readyBuilding = null; return true;
  }
  // ---- tick
  update(dt) {
    if (this.over) return;
    this.time += dt; this.map.update(dt);
    for (const t of this.teams) {
      t.powerMade = 0; t.powerUsed = 0;
      for (const b of this.buildings) if (b.team === t.id && !b.dead) { if (b.stats.power > 0) t.powerMade += b.stats.power; else t.powerUsed -= b.stats.power; }
      const speed = t.powerUsed > t.powerMade ? 0.5 : 1; // low power halves production speed
      for (const [cat, q] of Object.entries(t.queues)) {
        if (!q) continue; q.progress += dt * speed;
        if (q.progress >= q.time) {
          if (q.isBuilding) { t.readyBuilding = q.key; t.queues[cat] = null; }
          else { const p = this.buildings.find(b => b.team === t.id && !b.dead && b.stats.builds === cat);
            if (p) { const sp = p.spawnPoint(); const u = this.spawnUnit(q.key, t.id, sp.x + (Math.random() - .5) * 20, sp.y);
              if (p.rally) u.command({ type: 'move', x: p.rally.x, y: p.rally.y }); }
            t.queues[cat] = null; }
        }
      }
    }
    for (const b of this.buildings) if (!b.dead) b.update(dt);
    for (const u of this.units) if (!u.dead) u.update(dt);
    this.units = this.units.filter(u => !u.dead); this.buildings = this.buildings.filter(b => !b.dead);
    for (const e of this.effects) e.t -= dt; this.effects = this.effects.filter(e => e.t > 0);
    this.fog.update(this.entities);
    for (const team of [0, 1]) if (!this.buildings.some(b => b.team === team)) { this.over = team === 0 ? 'lose' : 'win'; }
  }
}
