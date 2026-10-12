// Player-side command layer: selection, orders, building placement + superweapon targeting state.
export class PlayerUI {
  constructor(game) { this.g = game; this.selection = new Set(); this.box = null; this.placing = null; this.targeting = false; this.hoverTile = { x: 0, y: 0 }; this.hoverWorld = null; }
  clearSelection() { this.selection.clear(); }
  select(e, add) { if (!add) this.selection.clear(); this.selection.add(e); }
  boxSelect(x0, y0, x1, y1, add) {
    if (!add) this.selection.clear();
    for (const u of this.g.units) if (u.team === 0 && u.type !== 'interceptor' && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) this.selection.add(u);
  }
  prune() { for (const e of this.selection) if (e.dead) this.selection.delete(e); if (this.targeting && !this.g.superReady(0)) this.targeting = false; }
  commandAt(x, y) {
    const target = this.g.entityAt(x, y);
    const tib = this.g.map.tib[this.g.map.idx(Math.floor(x / 32), Math.floor(y / 32))] > 5;
    const units = [...this.selection].filter(e => e.kind === 'unit');
    if (!units.length) { for (const b of this.selection) if (b.stats.builds && b.stats.builds !== 'building') b.rally = { x, y }; this.g.effects.push({ t: 0.3, ping: true, x, y }); return; }
    units.forEach((u, i) => {
      if (target && target.team !== u.team && this.g.combat) u.command({ type: 'attack', target });
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
      const army = this.g.units.filter(u => u.team === 0 && u.type !== 'interceptor' && u.type !== 'harvester');
      if (!army.length) return false;
      this.findIdx = ((this.findIdx ?? -1) + 1) % (army.length + 1);
      list = this.findIdx === 0 ? army : [army[this.findIdx - 1]];
    }
    const x = list.reduce((s, e) => s + e.x, 0) / list.length, y = list.reduce((s, e) => s + e.y, 0) / list.length;
    camera.centerOn(x, y); this.g.effects.push({ t: 0.3, ping: true, x, y }); return true;
  }
  beginPlacing(type) { this.placing = type; this.targeting = false; }
  place() { if (this.g.placeBuilding(0, this.hoverTile.x, this.hoverTile.y)) this.placing = null; }
  beginTargeting() { if (this.g.superReady(0)) { this.targeting = true; this.placing = null; } }
  fireAt(x, y) { if (this.g.fireSuper(0, x, y)) this.targeting = false; }
  cancel() { this.placing = null; this.box = null; this.targeting = false; }
  cancelPlacingOr(fn) { if (this.placing || this.targeting) { this.placing = null; this.targeting = false; } else fn(); }
}
