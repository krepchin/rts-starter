import { TILE, BUILDINGS } from '../data/stats.js?v=10.0';
import { FACTIONS } from '../data/factions.js?v=10.0';

// Scripted opponent using the same rules as the player: Construction Yard + queues, power, repair, superweapon, waves.
const BUILD_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'radar', 'turret', 'power', 'refinery', 'airfield', 'power', 'turret', 'power', 'ion', 'power', 'factory'];
// v10: the same plan for either faction, translated through faction roles (reptiles have no superweapon)
const ROLE_OF = { power: 'power', refinery: 'refinery', barracks: 'infantry', factory: 'vehicle', radar: 'radar', turret: 'def', airfield: 'air' };
const MIX = { human: { inf: ['infantry', 'infantry', 'rocket', 'sniper', 'rocket', 'infantry', 'engineer'], veh: ['tank', 'buggy', 'bike', 'tank', 'truck'], air: ['carrier', 'jet', 'jet', 'bomber'] },
  reptile: { inf: ['raider', 'raider', 'spitter', 'brute', 'raider', 'shaman', 'spitter'], veh: ['spark', 'biotank', 'lance', 'spark', 'biotank'], air: ['hiveorb', 'broodship'] },
  nordic: { inf: ['sentinel', 'sentinel', 'guardian', 'seer', 'sentinel', 'tallwhite'], veh: ['skiff'], air: ['lightcraft', 'lightcraft', 'lightship'] },
  grey: { inf: ['greydrone', 'greydrone', 'greydrone', 'hybrid', 'psionic', 'greydrone', 'abductor', 'hybrid'], veh: ['crawler', 'crawler', 'crawler'], air: ['probe', 'scoutsaucer', 'saucer', 'warsaucer', 'probe', 'mothership'] } };

export class EnemyAI {
  constructor(game, team = 1) { this.g = game; this.team = team; this.think = 0; this.waveTimer = 120; this.waveSize = 5; }
  update(dt) {
    this.think -= dt; this.waveTimer -= dt; if (this.think > 0) return; this.think = 1;
    const g = this.g, t = g.teams[this.team], me = this.team;
    if (g.over) return;
    const fac = t.faction || 'human', R = FACTIONS[fac].roles, mapB = k => fac === 'human' ? k : (ROLE_OF[k] ? R[ROLE_OF[k]] : null);
    const count = type => g.buildings.filter(b => b.team === me && b.type === type).length;
    const army = g.units.filter(u => u.team === me && !u.carrier && (u.stats.weapon || u.type === 'carrier' || u.type === 'mothership' || u.type === 'bomber' || u.type === 'medic'));
    // 1) Place a finished structure near base.
    if (t.readyBuilding) this.placeNearBase(t.readyBuilding);
    // 2) Next structure: fix power first, then build order, then extra defenses.
    if (!t.queues.building.length && !t.readyBuilding && g.has(me, 'cy')) {
      let next = null;
      if (t.powerUsed + 20 > t.powerMade && count(R.power) < 10) next = R.power;
      else { const need = {}; for (const k0 of BUILD_ORDER) { const k = mapB(k0); if (!k) continue; need[k] = (need[k] || 0) + 1; if (count(k) < need[k] && g.canProduce(me, k, true)) { next = k; break; } } }
      if (!next && t.credits > 2500 && count(R.def) < 6) next = R.def;
      if (!next && fac === 'reptile' && t.credits > 2000 && !count('broodspire') && g.canProduce(me, 'broodspire', true)) next = 'broodspire';
      if (next) g.enqueue(me, next, true);
    }
    // 3) Units: harvesters per refinery, then a steady army mix (short queues so structures still get funded).
    const harvs = g.units.filter(u => u.team === me && u.type === R.harvester).length;
    const qlen = c => t.queues[c].length;
    if (harvs < Math.min(4, count(R.refinery) * 2) && !g.queued(me, R.harvester, false)) g.enqueue(me, R.harvester, false);
    if (t.credits > 300 || g.time > 240) {
      if (qlen('infantry') < 2) { // v9 infantry mix: riflemen, plus snipers / rocket troopers / the odd engineer once unlocked
        const mix = MIX[fac].inf, k = mix[(this.inf = (this.inf || 0) + 1) % mix.length];
        g.enqueue(me, g.canProduce(me, k, false) ? k : mix[0], false); }
      if (qlen('vehicle') < 2) { const vm = MIX[fac].veh, k = vm[(this.veh = (this.veh || 0) + 1) % vm.length]; g.enqueue(me, g.canProduce(me, k, false) ? k : vm[0], false); }
      if (qlen('aircraft') < 1 && army.length > 6) { const air = MIX[fac].air, k = air[(this.air = (this.air || 0) + 1) % air.length]; g.enqueue(me, g.canProduce(me, k, false) ? k : air[0], false); }
      if (count('repairbay') < 1 && count('turret') >= 2 && g.time > 300 && g.canProduce(me, 'repairbay', true) && t.credits > 1500 && !t.queues.building.length && !t.readyBuilding) g.enqueue(me, 'repairbay', true);
    }
    // 3b) v9 defenses: a short wall arc with a gate toward the enemy, plus turrets (stops once a handful exist).
    if (fac === 'human' && g.has(me, 'barracks') && t.credits > 600 && g.time > 150) this.buildWalls(g, me, count);
    // 3c') v10 abilities for the new units
    for (const u of g.units) { if (u.team !== me || u.dead || !g.combat) continue; const tg = u.target && !u.target.dead ? u.target : null;
      if (u.type === 'raider' && tg && u.dist(tg) < 4 * TILE && u.dist(tg) > 1.5 * TILE && u.canUse()) u.useAbility();
      else if (u.type === 'brute' && u.hp < u.stats.hp * 0.6 && u.canUse()) u.useAbility();
      else if ((u.type === 'spitter' || u.type === 'shaman') && tg && (u.abCd || 0) <= 0 && Math.random() < 0.3) u.castAt(tg.x, tg.y);
      else if ((u.type === 'truck' || u.type === 'buggy') && tg && u.dist(tg) < 5 * TILE && u.canUse()) u.useAbility();
      else if (u.type === 'broodship' && u.canUse()) { const e = g.findEnemyNear(u, 7 * TILE, x => !x.dead && !x.isAir); if (e) u.castAt(e.x + (Math.random() - .5) * 40, e.y + 30); } }
    // 3c) Infantry abilities: stim when fighting, cloak snipers when hurt, dig in rockets on defense; engineers sabotage.
    for (const u of g.units) { if (u.team !== me || !u.stats.inf || u.dead) continue;
      const fighting = u.target && !u.target.dead && u.dist(u.target) < (u.stats.weapon?.range ?? 4) * TILE * 1.2;
      if ((u.type === 'infantry' || u.type === 'sentinel') && fighting && u.hp > 40 && u.canUse()) u.useAbility();
      else if (['guardian', 'tallwhite', 'psionic', 'abductor'].includes(u.type) && fighting && u.canUse()) u.useAbility();
      else if (u.type === 'hybrid' && u.hp < u.stats.hp * 0.6 && u.canUse()) u.useAbility();
      else if (u.type === 'sniper' && u.hp < u.stats.hp * 0.6 && u.canUse()) u.useAbility();
      else if (u.type === 'rocket' && !u.order && fighting && !u.dug && u.canUse()) u.useAbility();
      else if (u.type === 'engineer' && g.combat && !u.order && (this.engT = (this.engT || 0) + 1) % 20 === 0) {
        const foes = g.buildings.filter(b => b.team !== me && !b.packing && !b.stats.wall).sort((a, b) => a.dist(u) - b.dist(u)); const b = foes[0];
        if (b && b.dist(u) < 30 * TILE) u.command({ type: b.stats.cost >= 1000 && (u.abCd || 0) <= 0 ? 'demo' : 'capture', target: b }); } }
    // 3d) v9.1 Dropship raids: build one late, fill it with a squad, cloak, drop next to an enemy refinery.
    this.dropship(g, me, t);
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
  buildWalls(g, me, count) {
    if (count('wall') >= 10 && count('gate') >= 1) return;
    if (count('wall') >= 3 && !count('gate')) { // gate: any free tile touching one of our walls, toward the enemy side
      for (const w of g.buildings) if (w.team === me && w.stats.wall) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.placeInstant(me, 'gate', w.tx + dx, w.ty + dy)) return; }
    if (count('wall') >= 8) return;
    const cy = g.buildings.find(b => b.team === me && b.type === 'cy' && !b.packing), foe = g.buildings.find(b => b.team !== me && b.stats.yard) || { x: g.map.pxW / 2, y: g.map.pxH / 2 };
    if (!cy) return;
    const dx = foe.x - cy.x, dy = foe.y - cy.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, R = 8;
    const cx = Math.round(cy.x / TILE + ux * R), cy2 = Math.round(cy.y / TILE + uy * R);
    // line perpendicular to the enemy direction; the middle tile becomes the gate
    for (let i = -4; i <= 4; i++) { const tx = Math.round(cx - uy * i), ty = Math.round(cy2 + ux * i);
      const type = i === 0 ? 'gate' : 'wall'; if (g.wallAt(me, tx, ty) || g.buildings.some(b => b.team === me && b.tx === tx && b.ty === ty)) continue;
      if (type === 'gate' && !g.canPlaceInstant(me, 'gate', tx, ty)) continue;
      if (g.placeInstant(me, type, tx, ty)) return; }
  }
  dropship(g, me, t) {
    const ds = g.units.find(u => u.team === me && u.type === 'dropship');
    if (!ds) { if (g.time > 420 && t.credits > 1800 && !t.queues.aircraft.length && g.canProduce(me, 'dropship', false) && Math.random() < 0.05) g.enqueue(me, 'dropship', false); return; }
    if (ds.order?.type === 'unload') return;
    if (this.dropped) { for (const u of g.units) if (u.team === me && this.dropped.includes(u) && !u.order) { const tg = this.pickTarget(); if (tg) u.command({ type: 'attackMove', x: tg.x, y: tg.y }); } this.dropped = null; }
    if (ds.used < 4) { if ((this.dsT = (this.dsT || 0) + 1) % 5 === 0) ds.loadNearby(8); return; }
    if (!g.combat) return;
    const tgt = g.buildings.filter(b => b.team !== me && (b.type === 'refinery' || b.type === 'digester'))[0] || this.pickTarget(); if (!tgt) return;
    ds.setCloak(true); this.dropped = [...ds.cargo]; ds.unloadAt(tgt.x - 70, tgt.y + 60);
  }
  pickTarget() {
    const enemies = this.g.buildings.filter(b => b.team !== this.team);
    return enemies.find(b => b.type === 'refinery' || b.type === 'digester') || enemies.find(b => b.stats.yard) || enemies[0];
  }
  ionTarget() {
    const foes = this.g.buildings.filter(b => b.team !== this.team);
    let best = null, bs = 0;
    for (const f of foes) { const sc = foes.filter(o => o.dist(f) < 3 * TILE).length + (f.type === 'cy' ? 2 : 0); if (sc > bs) { bs = sc; best = f; } }
    return best;
  }
  placeNearBase(type) {
    const cy = this.g.buildings.find(b => b.team === this.team && b.stats.yard && !b.packing);
    if (!cy) return;
    for (let r = 2; r < 12; r++) for (let k = 0; k < 16; k++) {
      // search rings around the yard's centre (not its corner) so both map corners place equally well
      const s = BUILDINGS[type], a = k / 16 * Math.PI * 2, tx = Math.round(cy.tx + cy.w / 2 + Math.cos(a) * r - s.w / 2), ty = Math.round(cy.ty + cy.h / 2 + Math.sin(a) * r - s.h / 2);
      if (this.g.canPlace(this.team, type, tx, ty)) { this.g.placeBuilding(this.team, tx, ty); return; }
    }
  }
}
