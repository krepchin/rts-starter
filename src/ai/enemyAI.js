import { TILE, BUILDINGS } from '../data/stats.js';

// Scripted opponent using the same rules as the player: Construction Yard + queues, power, repair, superweapon, waves.
const BUILD_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'turret', 'power', 'refinery', 'airfield', 'power', 'turret', 'power', 'ion', 'power', 'factory'];

export class EnemyAI {
  constructor(game, team = 1) { this.g = game; this.team = team; this.think = 0; this.waveTimer = 120; this.waveSize = 5; }
  update(dt) {
    this.think -= dt; this.waveTimer -= dt; if (this.think > 0) return; this.think = 1;
    const g = this.g, t = g.teams[this.team], me = this.team;
    if (g.over) return;
    const count = type => g.buildings.filter(b => b.team === me && b.type === type).length;
    const army = g.units.filter(u => u.team === me && u.type !== 'interceptor' && (u.stats.weapon || u.type === 'carrier'));
    // 1) Place a finished structure near base.
    if (t.readyBuilding) this.placeNearBase(t.readyBuilding);
    // 2) Next structure: fix power first, then build order, then extra defenses.
    if (!t.queues.building.length && !t.readyBuilding && g.has(me, 'cy')) {
      let next = null;
      if (t.powerUsed + 20 > t.powerMade && count('power') < 10) next = 'power';
      else { const need = {}; for (const k of BUILD_ORDER) { need[k] = (need[k] || 0) + 1; if (count(k) < need[k] && g.canProduce(me, k, true)) { next = k; break; } } }
      if (!next && t.credits > 2500 && count('turret') < 6) next = 'turret';
      if (next) g.enqueue(me, next, true);
    }
    // 3) Units: harvesters per refinery, then a steady army mix (short queues so structures still get funded).
    const harvs = g.units.filter(u => u.team === me && u.type === 'harvester').length;
    const qlen = c => t.queues[c].length;
    if (harvs < Math.min(4, count('refinery') * 2) && !g.queued(me, 'harvester', false)) g.enqueue(me, 'harvester', false);
    if (t.credits > 300 || g.time > 240) {
      if (qlen('infantry') < 2) g.enqueue(me, 'infantry', false);
      if (qlen('vehicle') < 2) g.enqueue(me, 'tank', false);
      if (qlen('aircraft') < 1 && army.length > 6) g.enqueue(me, 'carrier', false);
    }
    // 4) Repair damaged structures when we can afford it.
    for (const b of g.buildings) if (b.team === me && !b.repairing && b.hp < b.stats.hp * 0.6 && t.credits > 500) g.toggleRepair(me, b);
    // 5) Superweapon: hit the densest cluster of known enemy structures.
    if (g.combat && g.superReady(me)) { const tgt = this.ionTarget(); if (tgt) g.fireSuper(me, tgt.x, tgt.y); }
    // 6) Attack waves (escalate over time so games end).
    const late = g.time > 900;
    if (g.combat && this.waveTimer <= 0 && army.length >= (late ? 4 : this.waveSize)) {
      const target = this.pickTarget();
      if (target) for (const u of army) u.command({ type: 'attackMove', x: target.x, y: target.y });
      this.waveTimer = late ? 45 : 90; this.waveSize = Math.min(14, this.waveSize + 2);
    }
    // 7) Mobile command centre: relocate the base when the yard is under siege; drive/burrow the walker to safety and redeploy.
    this.mobileBase(g, me);
    // Defend: idle units counter anything hitting our buildings.
    const hurt = g.buildings.find(b => b.team === me && b.lastAttacker && !b.lastAttacker.dead && b.dist(b.lastAttacker) < 10 * TILE);
    if (hurt) for (const u of army) if (!u.order) u.command({ type: 'attack', target: hurt.lastAttacker });
  }
  mobileBase(g, me) {
    const mb = g.units.find(u => u.team === me && u.carried);
    if (!mb) {
      const cy = g.buildings.find(b => b.team === me && b.type === 'cy' && !b.packing), atk = cy?.lastAttacker;
      if (cy && g.combat && cy.hp < cy.stats.hp * 0.45 && atk && !atk.dead && cy.dist(atk) < 9 * TILE && g.canMorph(me, cy)) {
        // retreat spot: away from the attacker, clamped inside the map
        const dx = cy.x - atk.x, dy = cy.y - atk.y, d = Math.hypot(dx, dy) || 1, m = g.map, R = 14 * TILE;
        this.reloc = { x: Math.max(6 * TILE, Math.min(m.pxW - 8 * TILE, cy.x + dx / d * R)), y: Math.max(6 * TILE, Math.min(m.pxH - 6 * TILE, cy.y + dy / d * R)) };
        g.transformBase(me, cy);
      }
      return;
    }
    if (mb.busy) return;
    const dest = this.reloc || { x: mb.x, y: mb.y };
    // Under fire and badly hurt: dig out (drill) toward the retreat spot; otherwise spray structures in reach.
    if (mb.type === 'robot' && mb.hp < mb.stats.hp * 0.5 && mb.lastAttacker && !mb.lastAttacker.dead && mb.dist(mb.lastAttacker) < 6 * TILE) {
      if (mb.mode !== 'drill') mb.setMode('drill'); else if (mb.canBurrow()) { mb.burrow(dest.x, dest.y); return; }
    } else if (mb.type === 'robot' && mb.mode !== 'spray' && mb.swapT <= 0) mb.setMode('spray');
    if (Math.hypot(mb.x - dest.x, mb.y - dest.y) > 2 * TILE) { if (!mb.order) mb.command({ type: 'move', x: dest.x, y: dest.y }); return; }
    // At the spot: find the nearest valid footprint and unfold.
    const bx = Math.round(mb.x / TILE - 1.5), by = Math.round(mb.y / TILE - 1.5);
    for (let r = 0; r < 10; r++) for (let k = 0; k < Math.max(1, r * 8); k++) {
      const a = k / Math.max(1, r * 8) * Math.PI * 2, tx = Math.round(bx + Math.cos(a) * r), ty = Math.round(by + Math.sin(a) * r);
      if (g.canDeploy(mb, tx, ty)) { mb.startDeploy(tx, ty); this.reloc = null; return; }
    }
    this.reloc = { x: mb.x + (Math.random() - .5) * 8 * TILE, y: mb.y + (Math.random() - .5) * 8 * TILE }; // blocked: try elsewhere
  }
  pickTarget() {
    const enemies = this.g.buildings.filter(b => b.team !== this.team);
    return enemies.find(b => b.type === 'refinery') || enemies.find(b => b.type === 'cy') || enemies[0];
  }
  ionTarget() {
    const foes = this.g.buildings.filter(b => b.team !== this.team);
    let best = null, bs = 0;
    for (const f of foes) { const sc = foes.filter(o => o.dist(f) < 3 * TILE).length + (f.type === 'cy' ? 2 : 0); if (sc > bs) { bs = sc; best = f; } }
    return best;
  }
  placeNearBase(type) {
    const cy = this.g.buildings.find(b => b.team === this.team && b.type === 'cy' && !b.packing);
    if (!cy) return;
    for (let r = 2; r < 12; r++) for (let k = 0; k < 16; k++) {
      // search rings around the yard's centre (not its corner) so both map corners place equally well
      const s = BUILDINGS[type], a = k / 16 * Math.PI * 2, tx = Math.round(cy.tx + cy.w / 2 + Math.cos(a) * r - s.w / 2), ty = Math.round(cy.ty + cy.h / 2 + Math.sin(a) * r - s.h / 2);
      if (this.g.canPlace(this.team, type, tx, ty)) { this.g.placeBuilding(this.team, tx, ty); return; }
    }
  }
}
