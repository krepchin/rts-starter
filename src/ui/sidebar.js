import { BUILDINGS, UNITS } from '../data/stats.js';
import { CATS, PRODUCER } from '../engine/game.js';

const TABS = { building: 'Base', infantry: 'Inf', vehicle: 'Veh', aircraft: 'Air' };
// Change-only DOM writers: the sidebar updates every frame, so only touch the DOM when a value actually changes
// (avoids per-frame text-node replacement, style recalcs and the flicker/jank that caused).
const setT = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const setW = (el, w) => { if (el._w !== w) { el._w = w; el.style.width = w; } };
const setD = (el, d) => { if (el.disabled !== d) el.disabled = d; };
const setC = (el, c, on) => { if (el.classList.contains(c) !== on) el.classList.toggle(c, on); };
const pct = f => `${Math.round(Math.max(0, Math.min(1, f)) * 200) / 2}%`;

// DOM sidebar: credits + power bar, tabbed build queues (count badges, pause/cancel), selected-building actions.
// Mouse: click = queue one (or place when ready), right-click = cancel one. Touch/pen: tap = queue, long-press = cancel one.
export class Sidebar {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.tab = 'building'; this.selKey = null;
    this.el = { credits: q('#credits'), power: q('#power'), made: q('#powerMade'), used: q('#powerUsed'), tabs: q('#buildTabs'),
      menu: q('#buildMenu'), pause: q('#qPause'), cancel: q('#qCancel'), status: q('#qStatus'), info: q('#selInfo'), actions: q('#selActions') };
    this.tabBtns = {};
    for (const [k, label] of Object.entries(TABS)) {
      const b = document.createElement('button'); b.dataset.tab = k; b.innerHTML = `<span>${label}</span><b class="badge"></b>`;
      b.addEventListener('click', () => { if (this.tab !== k) { this.tab = k; this.build(); } }); this.el.tabs.append(b); this.tabBtns[k] = { b, badge: b.querySelector('.badge') };
    }
    this.el.pause.addEventListener('click', () => this.g.togglePause(0, this.tab));
    this.el.cancel.addEventListener('click', () => this.g.cancel(0, this.tab));
    // Sidebar never shows the browser context menu (long-press on iOS/Android would otherwise pop it / select text).
    q('#sidebar').addEventListener('contextmenu', e => e.preventDefault());
    this.build();
  }
  items() {
    if (this.tab === 'building') return Object.keys(BUILDINGS).filter(k => BUILDINGS[k].buildable !== false).map(k => ({ key: k, s: BUILDINGS[k], isB: true }));
    return Object.keys(UNITS).filter(k => UNITS[k].from === this.tab && UNITS[k].buildable !== false).map(k => ({ key: k, s: UNITS[k], isB: false }));
  }
  build() { // only on tab switch
    for (const [k, { b }] of Object.entries(this.tabBtns)) setC(b, 'on', k === this.tab);
    this.el.menu.replaceChildren(); this.buttons = [];
    for (const it of this.items()) {
      const b = document.createElement('button'); b.dataset.key = it.key;
      b.innerHTML = `<span class="nm">${it.s.name}</span><small>$${it.s.cost}</small><b class="count"></b><i class="state"></i><div class="bar"></div>`;
      const cat = it.isB ? 'building' : it.s.from;
      let timer = 0, longFired = false, ptype = 'mouse';
      b.addEventListener('pointerdown', e => { ptype = e.pointerType; longFired = false; clearTimeout(timer);
        if (e.pointerType !== 'mouse') timer = setTimeout(() => { longFired = true; this.g.cancel(0, cat, it.key); navigator.vibrate?.(15); }, 550); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(timer));
      b.addEventListener('click', () => { if (longFired) { longFired = false; return; } this.click(it); });
      // Right-click cancels for mouse only; touch long-press is handled by the timer above (no double cancel).
      b.addEventListener('contextmenu', e => { e.preventDefault(); if (ptype === 'mouse') this.g.cancel(0, cat, it.key); });
      this.el.menu.append(b); this.buttons.push({ b, it, count: b.querySelector('.count'), state: b.querySelector('.state'), bar: b.querySelector('.bar') });
    }
  }
  click(it) {
    const t = this.g.teams[0];
    if (it.isB && t.readyBuilding === it.key) { this.ui.beginPlacing(it.key); return; }
    this.g.enqueue(0, it.key, it.isB);
  }
  update() {
    const g = this.g, t = g.teams[0], el = this.el;
    setT(el.credits, `$${Math.floor(t.credits)}`);
    setT(el.power, `⚡ ${t.powerUsed}/${t.powerMade}`); setC(el.power, 'low', t.lowPower);
    const max = Math.max(t.powerMade, t.powerUsed, 1);
    setW(el.made, pct(t.powerMade / max)); setW(el.used, pct(t.powerUsed / max)); setC(el.used, 'low', t.lowPower);
    for (const cat of CATS) {
      const n = t.queues[cat].length + (cat === 'building' && t.readyBuilding ? 1 : 0), tb = this.tabBtns[cat];
      setT(tb.badge, n ? String(n) : ''); setC(tb.b, 'ready', cat === 'building' && !!t.readyBuilding);
    }
    const cat = this.tab, qu = t.queues[cat];
    for (const { b, it, count, state, bar } of this.buttons) {
      const ready = it.isB && t.readyBuilding === it.key, n = qu.filter(x => x.key === it.key).length, head = qu[0]?.key === it.key ? qu[0] : null;
      setD(b, !ready && !n && (!g.canProduce(0, it.key, it.isB) || (it.isB && (qu.length > 0 || !!t.readyBuilding)) || (!it.isB && qu.length >= 5)));
      setC(b, 'ready', ready);
      setT(count, n > 1 || (!it.isB && n) ? String(n) : '');
      setT(state, ready ? 'READY' : head && t.paused[cat] ? 'PAUSED' : head && t.stalled[cat] ? 'HOLD' : '');
      setW(bar, head ? pct(head.progress / head.time) : ready ? '100%' : '0%');
    }
    const hasQ = qu.length > 0;
    setD(el.pause, !hasQ); setT(el.pause, t.paused[cat] ? 'Resume' : 'Pause');
    setD(el.cancel, !hasQ && !(cat === 'building' && t.readyBuilding));
    setT(el.status, !g.has(0, PRODUCER[cat]) ? (cat === 'building' ? 'No Construction Yard' : `Needs ${BUILDINGS[PRODUCER[cat]].name}`)
      : t.stalled[cat] ? `On hold: ${t.stalled[cat]}` : t.lowPower && hasQ ? 'Low power: slowed' : '');
    this.updateSelection(t);
  }
  updateSelection(t) {
    const g = this.g, sel = [...this.ui.selection], one = sel.length === 1 ? sel[0] : null;
    const isB = !!(one && one.kind === 'building' && one.team === 0);
    const key = isB ? `b${one.id}` : '';
    if (key !== this.selKey) { // rebuild action buttons only when the selection changes
      this.selKey = key; this.el.actions.replaceChildren(); this.act = {}; this.armed = null;
      if (isB) {
        const mk = (id, label, fn) => { const b = document.createElement('button'); b.textContent = label; b._t = label; b.addEventListener('click', fn); this.el.actions.append(b); this.act[id] = b; };
        mk('repair', 'Repair', () => g.toggleRepair(0, one));
        mk('sell', 'Sell', () => { if (this.armed === one) { g.sell(0, one); this.ui.clearSelection(); this.armed = null; } else { this.armed = one; clearTimeout(this.armT); this.armT = setTimeout(() => this.armed = null, 2500); } });
        if (one.stats.superweapon) mk('fire', 'Fire Ion', () => this.ui.beginTargeting());
      }
      setC(this.el.actions, 'has', isB);
    }
    if (isB) {
      const s = one.stats;
      setT(this.act.repair, one.repairing ? 'Repairing' : 'Repair'); setC(this.act.repair, 'on', one.repairing); setD(this.act.repair, one.hp >= s.hp && !one.repairing);
      setT(this.act.sell, this.armed === one ? `+$${Math.floor((s.cost || 0) * 0.5 * one.hp / s.hp)}?` : 'Sell'); setC(this.act.sell, 'armed', this.armed === one);
      if (this.act.fire) { const f = one.charge / s.superweapon.chargeTime; setD(this.act.fire, !g.superReady(0)); setT(this.act.fire, this.ui.targeting ? 'Target…' : f >= 1 ? 'FIRE' : `⚡${Math.floor(f * 100)}%`); }
      const lines = [`${s.name}`, `HP ${Math.ceil(one.hp)}/${s.hp} · Power ${s.power > 0 ? '+' : ''}${s.power}`];
      if (!one.powered && (s.weapon || s.radar || s.superweapon)) lines.push('OFFLINE: low power');
      else if (s.builds && s.builds !== 'building') lines.push('Tap map: set rally point');
      setT(this.el.info, lines.join('\n'));
      return;
    }
    setT(this.el.info, one ? `${one.stats.name}\nHP ${Math.ceil(one.hp)}/${one.stats.hp}` +
      (one.type === 'carrier' ? `\nInterceptors docked: ${one.docked}` : '') + (one.type === 'harvester' ? `\nLoad ${one.load | 0}` : '')
      : sel.length ? `${sel.length} selected` : this.ui.targeting ? 'Ion Cannon: tap a target (right-click/Esc cancels)'
      : t.readyBuilding ? 'Structure ready: tap it, then place on map' : !g.has(0, 'cy') ? 'Construction Yard lost!' : 'Tap/drag to select. Tap (or right-click) to command.');
  }
}
const q = s => document.querySelector(s);
