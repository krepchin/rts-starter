import { ME } from '../engine/local.js?v=10.2p';
import { BUILDINGS } from '../data/stats.js?v=10.2p';
// Player-side command layer: selection, orders, building placement + superweapon targeting state.
export class PlayerUI {
  constructor(game) { this.g = game; this.selection = new Set(); this.box = null; this.placing = null; this.targeting = false; this.hoverTile = { x: 0, y: 0 }; this.hoverWorld = null; }
  clearSelection() { this.selection.clear(); }
  // v8: deploy preview (full footprint) for a Mobile Yard / Base Walker, and Burrow target for the walker's drill.
  beginDeploy(mb) { this.cancel(); this.deploying = mb; }
  beginBurrow(mb) { if (mb.canBurrow()) { this.cancel(); this.burrowing = mb; } }
  deployTile(w) { return { x: Math.round(w.x / 32 - 1.5), y: Math.round(w.y / 32 - 1.5) }; }
  deployAt(w) { const t = this.deployTile(w); if (this.deploying.startDeploy(t.x, t.y)) this.deploying = null; }
  burrowAt(w) { if (this.burrowing.burrow(w.x, w.y)) { this.g.effects.push({ t: 0.3, ping: true, x: w.x, y: w.y }); this.burrowing = null; } }
  select(e, add) { if (!add) this.selection.clear(); this.selection.add(e); this.g.sfx?.('select'); if (e.team === ME) this.g.sfx?.('voice:select', e); }
  boxSelect(x0, y0, x1, y1, add) {
    if (!add) this.selection.clear();
    for (const u of this.g.units) if (u.team === ME && !u.carrier && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) this.selection.add(u);
    if (this.selection.size) this.g.sfx?.('select');
  }
  prune() { for (const e of this.selection) if (e.dead) { this.selection.delete(e); const n = e.becameUnit || e.becameBuilding; if (n && !n.dead) this.selection.add(n); }
    if (this.deploying && (this.deploying.dead || this.deploying.state !== 'ready')) this.deploying = null;
    if (this.burrowing && (this.burrowing.dead || !this.burrowing.canBurrow())) this.burrowing = null; if (this.targeting && !this.g.superReady(ME)) this.targeting = false; }
  commandAt(x, y) {
    const target = this.g.entityAt(x, y);
    const tib = this.g.map.tib[this.g.map.idx(Math.floor(x / 32), Math.floor(y / 32))] > 5;
    const units = [...this.selection].filter(e => e.kind === 'unit');
    if (!units.length) { for (const b of this.selection) if (b.stats.builds && b.stats.builds !== 'building') b.rally = { x, y }; this.g.effects.push({ t: 0.3, ping: true, x, y }); return; }
    const atk = target && target.team !== ME && this.g.combat; this.g.sfx?.(atk ? 'attack' : 'move'); this.g.sfx?.(atk ? 'voice:attack' : 'voice:move', units[0]);
    if (target && target.type === 'dropship' && target.team === ME) { let n = 0; // board: selected ground units climb into the tapped Dropship
      for (const u of units) if (u !== target && target.canTake(u)) { u.command({ type: 'board', target }); n++; }
      if (n) { this.g.sfx?.('move'); this.g.effects.push({ t: 0.3, ping: true, x, y }); return; } }
    units.forEach((u, i) => {
      if (target && target.team !== u.team && this.g.combat) u.command({ type: 'attack', target });
      else if (u.type === 'engineer' && target && target.team === u.team && target !== u && !target.stats.inf && !target.isAir && target.hp < target.stats.hp) u.command({ type: 'repair', target });
      else if ((u.type === 'medic' || u.stats.healer) && target && target.team === u.team && target !== u && target.stats.inf) u.command({ type: 'heal', target });
      else if (u.type === 'harvester' && tib) u.command({ type: 'harvest' });
      else { const n = Math.ceil(Math.sqrt(units.length)), ox = (i % n - (n - 1) / 2) * 26, oy = (Math.floor(i / n) - (n - 1) / 2) * 26;
        u.command({ type: 'move', x: x + ox, y: y + oy }); }
    });
    this.g.effects.push({ t: 0.3, ping: true, x, y });
  }
  // "Find my army": centre the camera on the selection, or (nothing selected) on own combat units.
  // Repeated finds with nothing selected cycle through own units so stragglers can be located too.
  find(camera) {
    let list = [...this.selection].filter(e => !e.dead);
    if (!list.length) {
      const army = this.g.units.filter(u => u.team === ME && !u.carrier && u.type !== 'harvester');
      if (!army.length) return false;
      this.findIdx = ((this.findIdx ?? -1) + 1) % (army.length + 1);
      list = this.findIdx === 0 ? army : [army[this.findIdx - 1]];
    }
    const x = list.reduce((s, e) => s + e.x, 0) / list.length, y = list.reduce((s, e) => s + e.y, 0) / list.length;
    camera.centerOn(x, y); this.g.effects.push({ t: 0.3, ping: true, x, y }); return true;
  }
  beginPlacing(type) { this.cancel(); this.placing = type; this.targeting = false; }
  // v9: walls/gates are instant (pay per tile). Walls stay in placing mode so you can keep tapping/dragging; gates place once.
  place() { const t = this.placing, h = this.hoverTile;
    if (BUILDINGS[t]?.instant) { if (this.g.placeInstant(ME, t, h.x, h.y) && BUILDINGS[t].gate) this.placing = null; return; }
    if (this.g.placeBuilding(ME, h.x, h.y)) this.placing = null; }
  placeWallLine(d) { let n = 0; for (const [x, y] of this.g.wallLine(d.x0, d.y0, d.x1, d.y1)) if (this.g.placeInstant(ME, this.placing, x, y)) n++; return n; }
  // v9 ability targeting: engineers capture / demo a tapped enemy building.
  beginUnload(ds) { if (ds.cargo.length) { this.cancel(); this.unloading = ds; } }
  unloadAt(w) { if (this.unloading.unloadAt(w.x, w.y)) { this.g.effects.push({ t: 0.3, ping: true, x: w.x, y: w.y }); this.g.sfx?.('move'); } this.unloading = null; }
  beginAbilityTarget(kind) { const pt = { acid: 'spitter', storm: 'shaman', eggs: 'broodship' }[kind];
    const us = [...this.selection].filter(u => u.kind === 'unit' && u.team === ME && (pt ? u.type === pt : u.type === 'engineer')); if (!us.length) return; this.cancel(); this.abilityTarget = { kind, units: us, point: !!pt }; }
  abilityAt(x, y) { const a = this.abilityTarget, b = this.g.entityAt(x, y);
    if (a.point) { let n = 0; for (const u of a.units) if (!u.dead && u.castAt(x, y)) { n++; if (a.kind !== 'acid') break; } this.g.effects.push({ t: 0.3, ping: true, x, y }); if (n) this.g.sfx?.('attack'); this.abilityTarget = null; return; }
    if (b && b.kind === 'building' && b.team !== ME) { const us = a.kind === 'capture' ? a.units : a.units.slice(0, 1); for (const u of us) if (!u.dead) u.command({ type: a.kind, target: b });
      this.g.sfx?.('attack'); this.g.effects.push({ t: 0.3, ping: true, x, y }); this.abilityTarget = null; } }
  useAbility() { let n = 0; for (const u of this.selection) if (u.kind === 'unit' && u.team === ME && u.useAbility?.()) n++; return n; }
  beginTargeting() { if (this.g.superReady(ME)) { this.targeting = true; this.placing = null; } }
  fireAt(x, y) { if (this.g.fireSuper(ME, x, y)) this.targeting = false; }
  cancel() { this.placing = null; this.box = null; this.targeting = false; this.deploying = null; this.burrowing = null; this.wallDrag = null; this.abilityTarget = null; this.unloading = null; }
  cancelPlacingOr(fn) { if (this.placing || this.targeting || this.deploying || this.burrowing || this.abilityTarget || this.unloading) this.cancel(); else fn(); }
}
