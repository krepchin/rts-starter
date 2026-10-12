import { BUILDINGS, UNITS, TILE } from '../data/stats.js';

// Simple scripted opponent: follows a build order, keeps producing, attacks in waves.
const BUILD_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'turret', 'power', 'airfield', 'refinery', 'turret', 'power'];

export class EnemyAI {
  constructor(game, team = 1) { this.g = game; this.team = team; this.think = 0; this.waveTimer = 120; this.waveSize = 5; }
  update(dt) {
    this.think -= dt; this.waveTimer -= dt; if (this.think > 0) return; this.think = 1;
    const g = this.g, t = g.teams[this.team], me = this.team;
    const count = type => g.buildings.filter(b => b.team === me && b.type === type).length;
    const army = g.units.filter(u => u.team === me && u.type !== 'interceptor' && (u.stats.weapon || u.type === 'carrier'));
    // 1) Place finished building near base.
    if (t.readyBuilding) this.placeNearBase(t.readyBuilding);
    // 2) Next item from build order (counting what we already have).
    if (!t.queues.building && !t.readyBuilding) {
      const need = {}; let next = null;
      for (const k of BUILD_ORDER) { need[k] = (need[k] || 0) + 1; if (count(k) < need[k]) { next = k; break; } }
      if (!next && t.powerUsed + 30 > t.powerMade) next = 'power';
      if (next) g.startProduction(me, next, true);
    }
    // 3) Units: keep 2 harvesters per refinery, then army mix. Keep a reserve for buildings early on.
    const harvs = g.units.filter(u => u.team === me && u.type === 'harvester').length;
    if (harvs < Math.min(4, count('refinery') * 2)) g.startProduction(me, 'harvester', false);
    if (t.credits > 400 || g.time > 240) {
      g.startProduction(me, 'infantry', false);
      g.startProduction(me, 'tank', false);
      if (army.length > 6) g.startProduction(me, 'carrier', false);
    }
    // 4) Attack waves.
    if (this.waveTimer <= 0 && army.length >= this.waveSize) {
      const target = this.pickTarget();
      if (target) for (const u of army) u.command({ type: 'attackMove', x: target.x, y: target.y });
      this.waveTimer = 90; this.waveSize = Math.min(14, this.waveSize + 2);
    }
    // Defend: anything attacking our buildings gets countered by idle units.
    const hurt = g.buildings.find(b => b.team === me && b.lastAttacker && !b.lastAttacker.dead && b.dist(b.lastAttacker) < 10 * TILE);
    if (hurt) for (const u of army) if (!u.order) u.command({ type: 'attack', target: hurt.lastAttacker });
  }
  pickTarget() {
    const enemies = this.g.buildings.filter(b => b.team !== this.team);
    return enemies.find(b => b.type === 'refinery') || enemies[0];
  }
  placeNearBase(type) {
    const cy = this.g.buildings.find(b => b.team === this.team && b.type === 'cy') || this.g.buildings.find(b => b.team === this.team);
    if (!cy) return;
    for (let r = 2; r < 12; r++) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, tx = Math.round(cy.tx + Math.cos(a) * r), ty = Math.round(cy.ty + Math.sin(a) * r);
      if (this.g.canPlace(this.team, type, tx, ty)) { this.g.placeBuilding(this.team, tx, ty); return; }
    }
  }
}
