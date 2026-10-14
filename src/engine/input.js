import { ME } from './local.js?v=10.0';
import { TILE, BUILDINGS } from '../data/stats.js?v=10.0';

// Unified mouse/pen/touch input via Pointer Events.
// Mouse: left click select, left drag box-select, right click move/attack, edge-scroll, WASD/arrows pan.
// Touch: tap select / tap ground or enemy to command selection, one-finger drag on empty ground = box select,
//        drag starting on a selected unit = no-op, two-finger drag = pan, long-press = deselect.
export class Input {
  constructor(canvas, game, camera, ui) {
    this.c = canvas; this.g = game; this.cam = camera; this.ui = ui;
    this.keys = new Set(); this.mouse = null; this.pointers = new Map(); this.down = null; this.longTimer = 0;
    const opt = { passive: false };
    canvas.addEventListener('pointerdown', e => this.onDown(e), opt);
    canvas.addEventListener('pointermove', e => this.onMove(e), opt);
    canvas.addEventListener('pointerup', e => this.onUp(e), opt);
    canvas.addEventListener('pointercancel', e => this.onCancel(e));
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.mouse = null; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // iOS Safari: block page scroll/zoom gestures that touch-action alone may not stop.
    for (const ev of ['touchstart', 'touchmove']) canvas.addEventListener(ev, e => e.preventDefault(), opt);
    document.addEventListener('gesturestart', e => e.preventDefault());
    window.addEventListener('keydown', e => { if (e.key === ' ' || e.key.toLowerCase() === 'f') { e.preventDefault(); if (!e.repeat) this.ui.find(this.cam); }
      this.keys.add(e.key.toLowerCase()); if (e.key === 'Escape') this.ui.cancel(); if (e.key.startsWith('Arrow')) e.preventDefault(); });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  pos(e) { const r = this.c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  onDown(e) {
    e.preventDefault(); try { this.c.setPointerCapture?.(e.pointerId); } catch {}
    const p = this.pos(e); this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) { this.down = null; this.ui.box = null; this.ui.wallDrag = null; clearTimeout(this.longTimer); return; } // start pan
    if (this.pointers.size > 2) return;
    this.down = { ...p, button: e.button, type: e.pointerType, moved: false, t: performance.now() };
    if (this.ui.placing && BUILDINGS[this.ui.placing].wall && e.button === 0) { this.updateHover(p); const h = this.ui.hoverTile; this.ui.wallDrag = { x0: h.x, y0: h.y, x1: h.x, y1: h.y }; return; }
    if (e.pointerType !== 'mouse') this.longTimer = setTimeout(() => { if (this.down && !this.down.moved) { this.ui.clearSelection(); this.down = null; } }, 600);
  }
  onMove(e) {
    const p = this.pos(e);
    if (e.pointerType === 'mouse') this.mouse = p;
    this.updateHover(p);
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    if (this.pointers.size === 2) {
      const prev = this.pointers.get(e.pointerId); this.cam.pan(-(p.x - prev.x) / 2 * 2, -(p.y - prev.y) / 2 * 2);
      this.pointers.set(e.pointerId, p); return;
    }
    this.pointers.set(e.pointerId, p);
    const d = this.down; if (!d) return;
    if (Math.hypot(p.x - d.x, p.y - d.y) > (d.type === 'mouse' ? 5 : 12)) d.moved = true;
    if (this.ui.wallDrag) { const h = this.ui.hoverTile; this.ui.wallDrag.x1 = h.x; this.ui.wallDrag.y1 = h.y; return; }
    if (d.moved && d.button === 0 && !this.ui.placing && !this.ui.abilityTarget && !this.ui.unloading && !this.ui.targeting && !this.ui.deploying && !this.ui.burrowing) this.ui.box = { x0: Math.min(d.x, p.x), y0: Math.min(d.y, p.y), x1: Math.max(d.x, p.x), y1: Math.max(d.y, p.y) };
  }
  onUp(e) {
    clearTimeout(this.longTimer);
    const p = this.pos(e); const d = this.down; this.pointers.delete(e.pointerId);
    if (!d || this.pointers.size > 0) { this.down = null; return; }
    this.down = null;
    const w = this.cam.toWorld(p.x, p.y);
    if (d.button === 2) { this.ui.cancelPlacingOr(() => this.ui.commandAt(w.x, w.y)); return; }
    if (this.ui.targeting) { this.ui.fireAt(w.x, w.y); return; }
    if (this.ui.deploying) { this.ui.deployAt(w); return; }
    if (this.ui.burrowing) { this.ui.burrowAt(w); return; }
    if (this.ui.abilityTarget) { this.ui.abilityAt(w.x, w.y); return; }
    if (this.ui.unloading) { this.ui.unloadAt(w); return; }
    if (this.ui.wallDrag) { const wd = this.ui.wallDrag; this.ui.wallDrag = null; if (wd.x0 !== wd.x1 || wd.y0 !== wd.y1) { this.ui.placeWallLine(wd); return; } }
    if (this.ui.placing) { this.updateHover(p); this.ui.place(); return; }
    if (this.ui.box) { const b = this.ui.box; this.ui.box = null;
      const a = this.cam.toWorld(b.x0, b.y0), c = this.cam.toWorld(b.x1, b.y1); this.ui.boxSelect(a.x, a.y, c.x, c.y, e.shiftKey); return; }
    // Click/tap: select own thing, otherwise (touch, or mouse with selection) command.
    const hit = this.g.entityAt(w.x, w.y);
    if (hit && hit.team === ME && hit.type === 'dropship' && [...this.ui.selection].some(u => u !== hit && hit.canTake?.(u))) { this.ui.commandAt(w.x, w.y); return; } // board
    if (hit && hit.team === ME) {
      // double-click / double-tap an own unit: centre the camera on the selection
      const now = performance.now(), dbl = this.lastTap && this.lastTap.e === hit && now - this.lastTap.t < 350;
      this.lastTap = { e: hit, t: now };
      if (dbl) { this.ui.find(this.cam); return; }
      this.ui.select(hit, e.shiftKey);
    }
    else if (d.type !== 'mouse' && this.ui.selection.size) this.ui.commandAt(w.x, w.y);
    else if (!hit) this.ui.clearSelection(); else this.ui.select(hit, false);
  }
  onCancel(e) { this.pointers.delete(e.pointerId); this.down = null; this.ui.wallDrag = null; this.ui.box = null; clearTimeout(this.longTimer); }
  updateHover(p) {
    this.ui.hoverWorld = this.cam.toWorld(p.x, p.y);
    if (!this.ui.placing) return; const s = BUILDINGS[this.ui.placing], w = this.cam.toWorld(p.x, p.y);
    this.ui.hoverTile = { x: Math.round(w.x / TILE - s.w / 2), y: Math.round(w.y / TILE - s.h / 2) };
  }
  update(dt) {
    const k = this.keys, sp = 700 * dt; let dx = 0, dy = 0;
    if (k.has('a') || k.has('arrowleft')) dx -= sp; if (k.has('d') || k.has('arrowright')) dx += sp;
    if (k.has('w') || k.has('arrowup')) dy -= sp; if (k.has('s') || k.has('arrowdown')) dy += sp;
    const m = this.mouse, edge = 14;
    if (m && !this.down) { if (m.x < edge) dx -= sp; if (m.x > this.cam.vw - edge) dx += sp; if (m.y < edge) dy -= sp; if (m.y > this.cam.vh - edge) dy += sp; }
    if (dx || dy) this.cam.pan(dx, dy);
  }
}
