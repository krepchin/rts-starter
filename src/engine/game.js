import { Jet, Bomber } from '../entities/air.js?v=10.0';
import { TILE, BUILDINGS, UNITS, ECONOMY } from '../data/stats.js?v=10.0';
import { GameMap } from '../world/map.js?v=10.0';
import { Fog } from '../world/fog.js?v=10.0';
import { Building } from '../entities/building.js?v=10.0';
import { Unit, Harvester } from '../entities/unit.js?v=10.0';
import { Carrier, Interceptor } from '../entities/carrier.js?v=10.0';
import { Dropship } from '../entities/dropship.js?v=10.0';
import { resetIds } from '../entities/entity.js?v=10.0';
import { MobileBase, FORMATION } from '../entities/mcv.js?v=10.0';
import { FactionHarvester, Lightcraft, Saucer } from '../entities/aliens.js?v=10.0';
import { FACTIONS, factionOf } from '../data/factions.js?v=10.0';
import { Egg, HiveOrb, BroodShip, Truck, Grazer } from '../entities/reptile.js?v=10.0';
export const MORPH_TIME = { pack: 2.6, transform: 5.1 }; // hand-off at 78%, then the unit rises (~1 s): ~4 s / ~2 s total
// where each folded building ends up relative to the walker/crawler ground point (matches the painted walker layers)
export const ATTACH = { transform: { cy: [-12, -62], barracks: [-48, -44], factory: [38, -62], power: [-18, -88] }, pack: { cy: [0, -22] } };

const UNIT_CLASSES = { harvester: Harvester, carrier: Carrier, jet: Jet, bomber: Bomber, dropship: Dropship, egg: Egg, hiveorb: HiveOrb, broodship: BroodShip, truck: Truck, buggy: Truck, bike: Truck, grazer: Grazer, harmonizer: FactionHarvester, reaper: FactionHarvester, lightcraft: Lightcraft, saucer: Saucer, mothership: Carrier, scoutsaucer: Unit, warsaucer: Unit };
export const CATS = ['building', 'infantry', 'vehicle', 'aircraft'];
export const GRACE_SECONDS = 600; // optional ceasefire at game start (applies to both sides)
export const PRODUCER = { building: 'cy', infantry: 'barracks', vehicle: 'factory', aircraft: 'airfield' };

// Holds all simulation state. Rendering/UI read from it; input/AI write commands to it.
export class Game {
  constructor(opts = {}) { this.init(opts); }
  get me() { return this.viewTeam || 0; }
  // v10 multiplayer: rebuild the whole match in place (same Game object, same map object) so UI/renderer references stay valid
  reset(opts = {}) { resetIds(); const keep = this.map; this.init(opts); Object.assign(keep, this.map); this.map = keep; this.fog = new Fog(keep, this.me); }
  init(opts = {}) {
    this.map = new GameMap(88, 88);
    this.graceUntil = opts.grace ? GRACE_SECONDS : 0;
    this.units = []; this.buildings = []; this.effects = []; this.morphs = []; this.charges = []; this.bombs = []; this.shake = 0; this.rockets = []; this.decals = []; this.zones = []; this.lowFx = false;
    const fac = opts.factions || ['human', 'human'];
    this.teams = [0, 1].map(id => ({ id, faction: fac[id], credits: ECONOMY.startCredits, powerMade: 0, powerUsed: 0, lowPower: false, radar: false,
      queues: { building: [], infantry: [], vehicle: [], aircraft: [] }, paused: {}, stalled: {}, rr: {}, readyBuilding: null }));
    this.fog = new Fog(this.map, 0);
    this.over = null; this.winner = null; this.time = 0;
    this.viewTeam = opts.me || 0; this.opts = opts;
    this.setupSkirmish();
  }
  setupSkirmish() {
    const m = this.map;
    // Fields mirrored through the map centre so both bases get the same economy.
    for (const [x, y, r] of [[14, 20, 4], [20, 8, 3], [30, 58, 3], [12, 72, 4]]) { m.addField(x, y, r); m.addField(87 - x, 87 - y, r); }
    m.addField(44, 44, 5);
    const F = t => FACTIONS[this.teams[t].faction];
    this.addBuilding(F(0).start.yard, 0, 6, 6).age = 9; this.spawnUnit(F(0).roles.harvester, 0, 10 * TILE, 12 * TILE);
    F(0).start.units.forEach((k, i) => this.spawnUnit(k, 0, (9 + (i % 3) * 1.1) * TILE, (10 + Math.floor(i / 3) * 0.9 + (i % 2) * 0.4) * TILE));
    this.addBuilding(F(1).start.yard, 1, 79, 79).age = 9; this.spawnUnit(F(1).roles.harvester, 1, 79 * TILE, 77 * TILE);
    if (this.opts?.mp) { const [a1, b1, c1] = F(1).start.units; this.spawnUnit(a1, 1, 78 * TILE, 78 * TILE); this.spawnUnit(b1, 1, 80 * TILE, 78 * TILE); this.spawnUnit(c1, 1, 79.5 * TILE, 77.5 * TILE); } // fair 1v1 start
    else this.spawnUnit(F(1).start.units[0], 1, 78 * TILE, 78 * TILE);
  }
  // ---- entity management
  addBuilding(type, team, tx, ty) {
    if (type === 'cy' && this.teams[team].startLeft === undefined) this.teams[team].startLeft = tx + 1.5 < this.map.w / 2; // start side
    const b = new Building(this, type, team, tx, ty); this.buildings.push(b);
    if (b.stats.freeUnit) { const p = b.spawnPoint(); this.spawnUnit(b.stats.freeUnit, team, p.x, p.y); }
    return b;
  }
  spawnUnit(type, team, x, y) {
    const C = UNIT_CLASSES[type] || Unit; const u = new C(this, ...(C === Unit ? [type, team, x, y] : [team, x, y, type]));
    this.units.push(u); return u;
  }
  spawnInterceptor(carrier, type) { const i = new Interceptor(this, carrier, type); this.units.push(i); return i; }
  removeQuiet(e) { e.dead = true; e.quiet = true; }
  onDeath(e) { if (!e.quiet) { this.effects.push({ t: 0.6, boom: true, x: e.x, y: e.y, r: e.radius * 1.6 }); this.sfx?.(e.kind === 'building' || e.radius > 20 ? 'boom_l' : e.stats.inf ? 'die_inf' : 'boom_m', e); } }
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
  faction(team) { return this.teams[team].faction; }
  role(team, r) { return FACTIONS[this.teams[team].faction].roles[r]; }
  prodType(team, cat) { return FACTIONS[this.teams[team].faction].producer[cat]; }
  // 'cy' means "this team's yard" (Construction Yard or Hive Nest) so legacy checks keep working for both factions
  has(team, type) { if (type === 'cy') type = this.role(team, 'yard'); return this.buildings.some(b => b.team === team && b.type === type && !b.dead && !b.packing); }
  producers(team, cat) { const p = this.prodType(team, cat); return this.buildings.filter(b => b.team === team && !b.dead && !b.packing && b.type === p); }
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
    if (factionOf(s) !== this.teams[team].faction) return false;
    return this.has(team, this.prodType(team, this.catOf(key, isB))) && (s.req || []).every(r => this.has(team, r));
  }
  queued(team, key, isB) { return this.teams[team].queues[this.catOf(key, isB)].filter(q => q.key === key).length; }
  enqueue(team, key, isB) {
    const t = this.teams[team], q = t.queues[this.catOf(key, isB)], s = isB ? BUILDINGS[key] : UNITS[key];
    if (!this.canProduce(team, key, isB)) return false;
    if (isB ? (q.length || t.readyBuilding) : q.length >= ECONOMY.queueMax) return false;
    q.push({ key, isB, progress: 0, time: s.time, cost: s.cost, paid: 0 }); if (team === this.me) this.sfx?.('queue'); return true;
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
    if (!this.buildings.some(b => !b.dead && !b.packing && b.team === team && b.stats.yard && Math.hypot(b.x - cx, b.y - cy) <= 12 * TILE)) return false;
    return this.buildings.some(b => !b.dead && b.team === team && Math.abs(b.x - (tx + s.w / 2) * TILE) < (b.w / 2 + s.w / 2 + 5) * TILE && Math.abs(b.y - (ty + s.h / 2) * TILE) < (b.h / 2 + s.h / 2 + 5) * TILE);
  }
  // v9 instant defenses (walls, gates): no queue, pay per placed tile. Gates must touch a wall.
  wallAt(team, tx, ty) { return this.buildings.find(b => !b.dead && b.team === team && (b.stats.wall || b.stats.gate) && b.tx === tx && b.ty === ty); }
  canPlaceInstant(team, type, tx, ty) {
    const s = BUILDINGS[type]; if (!s?.instant || !this.canProduce(team, type, true) || this.teams[team].credits < s.cost || !this.canPlace(team, type, tx, ty)) return false;
    if (s.gate) return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.wallAt(team, tx + dx, ty + dy));
    return true;
  }
  placeInstant(team, type, tx, ty) {
    if (!this.canPlaceInstant(team, type, tx, ty)) return false;
    this.teams[team].credits -= BUILDINGS[type].cost; const b = this.addBuilding(type, team, tx, ty); b.age = BUILDINGS[type].faction === 'reptile' ? 0 : 0.6;
    if (team === this.me) this.sfx?.('wall'); return b;
  }
  // Tiles of a straight wall line from (x0,y0) to (x1,y1) (dominant axis), for drag placement.
  wallLine(x0, y0, x1, y1) { const out = [], h = Math.abs(x1 - x0) >= Math.abs(y1 - y0), n = h ? Math.abs(x1 - x0) : Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    for (let i = 0; i <= Math.min(n, 30); i++) out.push(h ? [x0 + sx * i, y0] : [x0, y0 + sy * i]); return out; }
  placeBuilding(team, tx, ty) {
    const t = this.teams[team]; if (!t.readyBuilding || !this.canPlace(team, t.readyBuilding, tx, ty)) return false;
    this.addBuilding(t.readyBuilding, team, tx, ty); t.readyBuilding = null; if (team === this.me) this.sfx?.('build'); return true;
  }
  // ---- building abilities
  sell(team, b) {
    if (!b || b.dead || b.team !== team || b.kind !== 'building') return 0;
    const refund = Math.floor((b.stats.cost || 0) * ECONOMY.sellRefund * b.hp / b.stats.hp);
    this.teams[team].credits += refund; if (team === this.me) this.sfx?.('sell', b);
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
    for (const b of parts) { b.packing = true; b.repairing = false; b.landed = false; }
    this.morphs.push({ team, cy, mode, parts, t: 0, dur: MORPH_TIME[mode] }); if (team === this.me) this.sfx?.('transform'); return true;
  }
  // v9 staged mechanical transform (forward when packing, reversed on deploy). Stage times as fractions of m.dur:
  //  0-0.2 warning lights + lift on hydraulic jacks (steam); 0.2-0.5 each building folds in turn;
  //  0.5-0.78 parts swing in on arcs with overshoot (sparks + clank); 0.78 hand-off -> walker/crawler rises (legs unfold, stomp).
  updateMorphs(dt) {
    for (const m of this.morphs) {
      m.t += dt; const P = m.t / m.dur;
      if (m.cy.dead) { for (const b of m.parts) { b.packing = false; b.morph = null; } m.done = true; continue; } // yard destroyed mid-pack
      m.parts = m.parts.filter(b => !b.dead); const gx = m.cy.x, gy = m.cy.y + TILE;
      m.parts.forEach((b, i) => {
        b.morph = { P: Math.min(P, 0.78), i, n: m.parts.length, sx: b.x, sy: b.y, ax: gx + ATTACH[m.mode][b.type][0], ay: gy + ATTACH[m.mode][b.type][1], mode: m.mode };
        if (P < 0.22 && Math.random() < dt * 14) this.puff(b.x + (Math.random() - .5) * b.w * TILE, b.y + b.h * TILE / 2, '#e8e4dc', 18, 7, 1.0, 30); // steam from the jacks
        const land = 0.5 + i * 0.04 + 0.24; if (!b.landed && P >= land) { b.landed = true; this.sparks(b.morph.ax, b.morph.ay); if (m.team === this.me) this.sfx?.('clank'); }
      });
      if (m.team === this.me) for (const [k, at] of [['alarm', 0], ['hiss', 0.06], ['servo', 0.22]]) if (!m[k] && P >= at) { m[k] = true; this.sfx?.(k); }
      if (P < 0.78) continue;
      m.done = true;
      const carried = m.parts.map(b => ({ type: b.type, hpFrac: b.hp / b.stats.hp }));
      for (const b of m.parts) this.removeQuiet(b);
      const u = new MobileBase(this, m.mode === 'pack' ? 'mcv' : 'robot', m.team, gx, gy, carried);
      this.units.push(u); m.cy.becameUnit = u;
    }
    this.morphs = this.morphs.filter(m => !m.done);
  }
  puff(x, y, color, spd, size, life, up = 0) { if (this.effects.length > 700) return; const a = Math.random() * 7, v = spd * (0.4 + Math.random() * 0.6);
    this.effects.push({ part: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - up, g: 0, size, color, t: life, life }); }
  // v9.1/v10 painted rockets: projectile with body + fins, backblast and smoke puff at launch, curling smoke trail, flame glow,
  // impact flash + debris + scorch decal. Purely visual (damage is applied by the weapon); particle counts are halved on phones (lowFx).
  fxRocket(src, tgt) { if (this.rockets.length > 40) return; const a = Math.atan2(tgt.y - src.y, tgt.x - src.x), x = src.x + Math.cos(a) * 8, y = src.y - 12;
    const n = this.lowFx ? 3 : 6; for (let i = 0; i < n; i++) this.puff(x - Math.cos(a) * 12, y - Math.sin(a) * 6, i < 2 ? '#ffcf7a' : '#bdb6a6', 50, 3 + Math.random() * 2, 0.5 + Math.random() * 0.4, 10);
    this.rockets.push({ x0: x, y0: y, x1: tgt.x, y1: tgt.y - (tgt.isAir ? 20 : 4), x, y, k: 0, dur: Math.max(0.25, Math.hypot(tgt.x - x, tgt.y - y) / 420), seed: Math.random() * 6, trailT: 0, a, air: !!tgt.isAir }); }
  updateRockets(dt) {
    for (const r of this.rockets) { r.k += dt / r.dur; const k = Math.min(1, r.k), arc = Math.sin(k * Math.PI) * 16 * (r.air ? 0.3 : 1);
      const nx = r.x0 + (r.x1 - r.x0) * k + Math.sin(k * 9 + r.seed) * 2.5, ny = r.y0 + (r.y1 - r.y0) * k - arc; r.a = Math.atan2(ny - r.y, nx - r.x); r.x = nx; r.y = ny;
      r.trailT -= dt; if (r.trailT <= 0 && this.effects.length < 700) { r.trailT = this.lowFx ? 0.045 : 0.022;
        this.effects.push({ part: true, smoke: true, x: r.x - Math.cos(r.a) * 6, y: r.y - Math.sin(r.a) * 6, vx: (Math.random() - .5) * 14, vy: -8 - Math.random() * 8, g: -6, size: 2.2, grow: 9, color: '#cfc8b8', t: 0.9, life: 0.9, curl: r.seed }); }
      if (r.k >= 1) { r.done = true; this.rocketHit(r.x1, r.y1, !r.air); } }
    this.rockets = this.rockets.filter(r => !r.done);
    if (this.decals.length) { for (const d of this.decals) d.t -= dt; this.decals = this.decals.filter(d => d.t > 0); }
  }
  rocketHit(x, y, ground) {
    this.effects.push({ t: 0.18, flash: true, x, y, r: 26 }); this.effects.push({ t: 0.45, boom: true, x, y, r: 14 });
    const n = this.lowFx ? 5 : 10; for (let i = 0; i < n && this.effects.length < 700; i++) { const a = Math.random() * 7, v = 50 + Math.random() * 110;
      this.effects.push({ part: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 70, g: 300, size: 1.4, color: i % 3 ? '#5a4a36' : '#ffb347', glow: i % 3 === 0, t: 0.6, life: 0.6 }); }
    for (let i = 0; i < (this.lowFx ? 2 : 4); i++) this.puff(x, y, '#8d8273', 30, 4, 0.9, 12);
    if (ground) { this.decals.push({ x, y, r: 9 + Math.random() * 4, t: 25, life: 25, rot: Math.random() * 3 }); if (this.decals.length > 40) this.decals.shift(); }
  }
  sparks(x, y) { for (let i = 0; i < 14 && this.effects.length < 700; i++) { const a = Math.random() * 7, v = 60 + Math.random() * 120;
    this.effects.push({ part: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60, g: 320, size: 1.6, color: Math.random() < .5 ? '#ffd27a' : '#fff3c0', glow: true, t: 0.5, life: 0.5 }); } }
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
      b.hp = Math.max(1, b.stats.hp * frac); b.age = 9; const mode = mb.type === 'robot' ? 'transform' : 'pack', A = ATTACH[mode][c.type] || [0, -20];
      b.unfold = { t: 0, P: 0.78, dur: mb.type === 'robot' ? 2.8 : 1.4, i: mb.carried.indexOf(c), n: mb.carried.length, ax: mb.x + A[0], ay: mb.y + A[1], mode };
      this.buildings.push(b); if (c.type === 'cy') cy = b;
    }
    this.removeQuiet(mb); mb.becameBuilding = cy; if (mb.team === this.me) this.sfx?.('build'); this.effects.push({ t: 0.8, sell: true, x: mb.x, y: mb.y, r: 70 });
    return true;
  }
  // ---- tick
  // v9.1 detection: cloaked units near an enemy Tiberium Cannon, Comm Center or detector unit are revealed (targetable).
  updateDetection() {
    const R = 6.5 * TILE;
    for (const u of this.units) { if (!u.cloaked) { u.detected = false; continue; }
      u.detected = this.buildings.some(b => !b.dead && b.team !== u.team && (b.type === 'turret' || b.stats.radar || b.stats.detector) && b.powered !== false && Math.hypot(b.x - u.x, b.y - u.y) < R)
        || this.units.some(e => !e.dead && e.team !== u.team && e.stats.detector && Math.hypot(e.x - u.x, e.y - u.y) < R); }
  }
  // v9.2.3: wall / gate occupancy grid (rebuilt each tick). Friendly gates count as open only while their openK > 0.5.
  rebuildSolid() { const m = new Map(); for (const b of this.buildings) if (!b.dead && (b.stats.wall || b.stats.gate)) m.set(b.ty * this.map.w + b.tx, b); this._solid = m; }
  solidAt(px, py, team) { if (!this._solid) return false; const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); const b = this._solid.get(ty * this.map.w + tx);
    return !!b && !b.dead && !(b.stats.gate && b.team === team && (b.openK || 0) > 0.5); }
  update(dt) {
    for (const u of this.units) if (u.life !== undefined && !u.dead) { u.life -= dt; if (u.life <= 0) { this.removeQuiet(u); this.puff(u.x, u.y - 6, '#9fdc7a', 30, 3, 0.6, 10); } }
    this.detT = (this.detT || 0) - dt; if (this.detT <= 0) { this.detT = 0.25; this.updateDetection(); }
    if (this.over) return;
    this.rebuildSolid();
    this.time += dt; this.map.update(dt); this.updateMorphs(dt);
    for (const t of this.teams) {
      t.powerMade = 0; t.powerUsed = 0;
      for (const b of this.buildings) if (b.team === t.id && !b.dead && !b.packing) { if (b.stats.power > 0) t.powerMade += b.stats.power; else t.powerUsed -= b.stats.power; }
      const wasLow = t.lowPower; t.lowPower = t.powerUsed > t.powerMade;
      if (t.id === 0 && this.time > 1 && wasLow !== t.lowPower) this.sfx?.(t.lowPower ? 'lowpower' : 'powerup');
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
          if (it.isB) { t.readyBuilding = it.key; if (t.id === 0) this.sfx?.('constructed'); }
          else {
            const p = prods[(t.rr[cat] = ((t.rr[cat] || 0) + 1) % prods.length)];
            const sp = p.spawnPoint(); const u = this.spawnUnit(it.key, t.id, sp.x + (Math.random() - .5) * 20, sp.y);
            if (t.id === 0) { this.sfx?.('ready'); this.sfx?.('voice:ready', u); }
            if (p.rally) u.command(u.load !== undefined ? { type: 'harvest' } : { type: 'move', x: p.rally.x, y: p.rally.y });
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
    for (const c of this.charges) { c.t -= dt; if (c.t <= 0 && !c.b.dead) { c.b.damage(600, null, true); this.effects.push({ t: 0.7, boom: true, x: c.b.x, y: c.b.y, r: c.b.radius * 1.8 }); this.sfx?.('boom'); this.shake = Math.max(this.shake, 4); } }
    for (const bm of this.bombs) { bm.t -= dt; if (bm.t <= 0) { // stealth bomber payload lands
      for (const e of [...this.units, ...this.buildings]) if (e.team !== bm.team && !e.dead && !e.isAir && Math.hypot(e.x - bm.x, e.y - bm.y) < bm.r + e.radius * 0.6) e.damage(bm.dmg * (e.kind === 'building' ? 1.2 : 1), bm.src);
      this.effects.push({ t: 0.6, boom: true, x: bm.x, y: bm.y, r: bm.r }); this.puff(bm.x, bm.y, '#3a3128', 30, 9, 1.2, 25); this.shake = Math.max(this.shake, 2.5); this.sfx?.('boom'); } }
    this.bombs = this.bombs.filter(bm => bm.t > 0);
    this.charges = this.charges.filter(c => c.t > 0 && !c.b.dead);
    this.shake = Math.max(0, this.shake - dt * 12);
    for (const b of this.buildings) if (!b.dead) b.update(dt);
    for (const u of this.units) if (!u.dead) {
      if (u.shieldT > 0) u.shieldT -= dt;
      const ha = u.stats.healAura; if (ha) for (const o of this.units) if (o.team === u.team && !o.dead && o !== u && o.hp < o.stats.hp && Math.hypot(o.x - u.x, o.y - u.y) < ha.r * TILE) o.hp = Math.min(o.stats.hp, o.hp + ha.hp * dt);
      if (u.stunT > 0) { u.stunT -= dt; if (u.stunT <= 0) u.lift = 0; } else
      u.update(dt);
      // Safety net for every unit class (Carrier/Harvester have their own update): never leave the map, never NaN.
      if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) { u.x = u.lastX ?? this.map.pxW / 2; u.y = u.lastY ?? this.map.pxH / 2; }
      u.x = Math.max(4, Math.min(this.map.pxW - 4, u.x)); u.y = Math.max(4, Math.min(this.map.pxH - 4, u.y)); u.lastX = u.x; u.lastY = u.y;
    }
    for (const u of this.units) if (!u.dead && !u.isAir && !u.carried) {
      if (this.solidAt(u.x, u.y, u.team)) { if (u.safeX !== undefined) { u.x = u.safeX; u.y = u.safeY; } else { const b = this._solid.get(Math.floor(u.y / TILE) * this.map.w + Math.floor(u.x / TILE)); u.y = (b.ty + b.h) * TILE + 6; } }
      else { u.safeX = u.x; u.safeY = u.y; } }
    this.units = this.units.filter(u => !u.dead); this.buildings = this.buildings.filter(b => !b.dead);
    this.updateRockets(dt);
    for (const z of this.zones) { z.t -= dt; if (!this.combat) continue; // acid pools / tiberium storms
      for (const u of this.units) if (u.team !== z.team && !u.dead && !u.isAir && Math.hypot(u.x - z.x, u.y - z.y) < z.r + u.radius) u.damage(z.dps * dt, null);
      for (const b of this.buildings) if (b.team !== z.team && !b.dead && Math.hypot(b.x - z.x, b.y - z.y) < z.r + b.radius * 0.6) b.damage(z.dps * z.bld * dt, null); }
    this.zones = this.zones.filter(z => z.t > 0);
    for (const e of this.effects) { e.t -= dt; if (e.part) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.g || 0) * dt; e.vx *= 0.97; if (e.curl !== undefined) e.vx += Math.sin(this.time * 5 + e.curl + e.t * 6) * 18 * dt; } }
    for (const b of this.buildings) if (b.unfold) { const u = b.unfold; u.t += dt; u.P = 0.78 * Math.max(0, 1 - u.t / u.dur);
      if (!u.dust && u.P < 0.05) { u.dust = true; for (let k = 0; k < 10; k++) this.puff(b.x + (Math.random() - .5) * b.w * TILE, b.y + b.h * TILE / 2, '#c9a77a', 40, 6, 0.9); if (b.team === this.me) this.sfx?.('clank'); }
      if (u.t >= u.dur) b.unfold = null; } this.effects = this.effects.filter(e => e.t > 0);
    this.fog.update(this.entities);
    for (const team of [0, 1]) if (!this.buildings.some(b => b.team === team) && !this.units.some(u => u.team === team && u.carried)) { this.over = team === 0 ? 'lose' : 'win'; this.winner = 1 - team; }
  }
}
