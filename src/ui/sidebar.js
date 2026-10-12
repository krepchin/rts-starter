import { BUILDINGS, UNITS } from '../data/stats.js';
import { CATS, PRODUCER } from '../engine/game.js';

const TABS = { building: 'Base', infantry: 'Inf', vehicle: 'Veh', aircraft: 'Air' };

// DOM sidebar: credits + power bar, tabbed build queues (count badges, pause/cancel), selected-building actions.
// Left click/tap = queue one (or place when ready). Right-click or long-press = cancel one (refunds what was paid).
export class Sidebar {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.tab = 'building'; this.selKey = '';
    this.el = { credits: q('#credits'), power: q('#power'), made: q('#powerMade'), used: q('#powerUsed'), tabs: q('#buildTabs'),
      menu: q('#buildMenu'), pause: q('#qPause'), cancel: q('#qCancel'), status: q('#qStatus'), info: q('#selInfo'), actions: q('#selActions') };
    this.tabBtns = {};
    for (const [k, label] of Object.entries(TABS)) {
      const b = document.createElement('button'); b.dataset.tab = k; b.innerHTML = `${label}<b></b>`;
      b.addEventListener('click', () => { this.tab = k; this.build(); }); this.el.tabs.append(b); this.tabBtns[k] = b;
    }
    this.el.pause.addEventListener('click', () => this.g.togglePause(0, this.tab));
    this.el.cancel.addEventListener('click', () => this.g.cancel(0, this.tab));
    this.build();
  }
  items() {
    if (this.tab === 'building') return Object.keys(BUILDINGS).filter(k => BUILDINGS[k].buildable !== false).map(k => ({ key: k, s: BUILDINGS[k], isB: true }));
    return Object.keys(UNITS).filter(k => UNITS[k].from === this.tab && UNITS[k].buildable !== false).map(k => ({ key: k, s: UNITS[k], isB: false }));
  }
  build() {
    for (const [k, b] of Object.entries(this.tabBtns)) b.classList.toggle('on', k === this.tab);
    this.el.menu.replaceChildren(); this.buttons = [];
    for (const it of this.items()) {
      const b = document.createElement('button'); b.dataset.key = it.key;
      b.innerHTML = `<span>${it.s.name}</span><small>$${it.s.cost}</small><b class="count"></b><i class="state"></i><div class="bar"></div>`;
      let longFired = false, timer = 0;
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { longFired = false; timer = setTimeout(() => { longFired = true; this.g.cancel(0, it.isB ? 'building' : it.s.from, it.key); }, 550); } });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(timer));
      b.addEventListener('click', () => { if (longFired) { longFired = false; return; } this.click(it); });
      b.addEventListener('contextmenu', e => { e.preventDefault(); if (!longFired) this.g.cancel(0, it.isB ? 'building' : it.s.from, it.key); });
      this.el.menu.append(b); this.buttons.push({ b, it, count: b.querySelector('.count'), state: b.querySelector('.state'), bar: b.querySelector('.bar') });
    }
  }
  click(it) {
    const t = this.g.teams[0];
    if (it.isB && t.readyBuilding === it.key) { this.ui.beginPlacing(it.key); return; }
    this.g.enqueue(0, it.key, it.isB);
  }
  update() {
    const g = this.g, t = g.teams[0];
    this.el.credits.textContent = `$${Math.floor(t.credits)}`;
    this.el.power.textContent = `⚡ ${t.powerUsed}/${t.powerMade}`; this.el.power.classList.toggle('low', t.lowPower);
    const max = Math.max(t.powerMade, t.powerUsed, 1);
    this.el.made.style.width = `${t.powerMade / max * 100}%`; this.el.used.style.width = `${t.powerUsed / max * 100}%`;
    this.el.used.classList.toggle('low', t.lowPower);
    for (const cat of CATS) {
      const n = t.queues[cat].length + (cat === 'building' && t.readyBuilding ? 1 : 0);
      this.tabBtns[cat].querySelector('b').textContent = n ? ` ${n}` : '';
      this.tabBtns[cat].classList.toggle('ready', cat === 'building' && !!t.readyBuilding);
    }
    const cat = this.tab, qu = t.queues[cat];
    for (const { b, it, count, state, bar } of this.buttons) {
      const ready = it.isB && t.readyBuilding === it.key, n = qu.filter(x => x.key === it.key).length, head = qu[0]?.key === it.key ? qu[0] : null;
      b.disabled = !ready && !n && (!g.canProduce(0, it.key, it.isB) || (it.isB && (qu.length || t.readyBuilding)) || (!it.isB && qu.length >= 5));
      b.classList.toggle('ready', ready);
      count.textContent = n > 1 || (!it.isB && n) ? n : '';
      state.textContent = ready ? 'READY' : head && t.paused[cat] ? 'PAUSED' : head && t.stalled[cat] ? 'HOLD' : '';
      bar.style.width = head ? `${head.progress / head.time * 100}%` : ready ? '100%' : '0';
    }
    const hasQ = qu.length > 0;
    this.el.pause.disabled = !hasQ; this.el.pause.textContent = t.paused[cat] ? 'Resume' : 'Pause';
    this.el.cancel.disabled = !hasQ && !(cat === 'building' && t.readyBuilding);
    this.el.status.textContent = !g.has(0, PRODUCER[cat]) ? (cat === 'building' ? 'No Construction Yard — cannot build' : `Needs ${BUILDINGS[PRODUCER[cat]].name}`)
      : t.stalled[cat] ? `On hold: ${t.stalled[cat]}` : t.lowPower && hasQ ? 'Low power: production slowed' : '';
    this.updateSelection(t);
  }
  updateSelection(t) {
    const g = this.g, sel = [...this.ui.selection], one = sel.length === 1 ? sel[0] : null;
    const isB = one && one.kind === 'building' && one.team === 0;
    const key = isB ? `b${one.id}` : '';
    if (key !== this.selKey) { // rebuild action buttons only when the selection changes (keeps taps reliable)
      this.selKey = key; this.el.actions.replaceChildren(); this.act = {};
      if (isB) {
        const mk = (id, label, fn) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', fn); this.el.actions.append(b); this.act[id] = b; };
        mk('repair', 'Repair', () => g.toggleRepair(0, one));
        mk('sell', 'Sell', () => { if (this.armed === one) { g.sell(0, one); this.ui.clearSelection(); this.armed = null; } else { this.armed = one; setTimeout(() => this.armed = null, 2500); } });
        if (one.stats.superweapon) mk('fire', 'Fire Ion', () => this.ui.beginTargeting());
      }
    }
    if (isB) {
      const s = one.stats;
      this.act.repair.textContent = one.repairing ? 'Repairing…' : 'Repair'; this.act.repair.classList.toggle('on', one.repairing); this.act.repair.disabled = one.hp >= s.hp && !one.repairing;
      this.act.sell.textContent = this.armed === one ? `Confirm +$${Math.floor((s.cost || 0) * 0.5 * one.hp / s.hp)}` : 'Sell';
      if (this.act.fire) { const f = one.charge / s.superweapon.chargeTime; this.act.fire.disabled = !g.superReady(0); this.act.fire.textContent = this.ui.targeting ? 'Tap target…' : f >= 1 ? 'Fire Ion ⚡' : `Ion ${Math.floor(f * 100)}%`; }
      const lines = [`${s.name}`, `HP ${Math.ceil(one.hp)}/${s.hp}`, `Power ${s.power > 0 ? '+' : ''}${s.power}`];
      if (!one.powered && (s.weapon || s.radar || s.superweapon)) lines.push('OFFLINE — low power');
      if (s.builds && s.builds !== 'building') lines.push('Tap/right-click map: set rally');
      this.el.info.textContent = lines.join('\n');
      return;
    }
    this.el.info.textContent = one ? `${one.stats.name}\nHP ${Math.ceil(one.hp)}/${one.stats.hp}` +
      (one.type === 'carrier' ? `\nInterceptors docked: ${one.docked}` : '') + (one.type === 'harvester' ? `\nLoad ${one.load | 0}` : '')
      : sel.length ? `${sel.length} selected` : this.ui.targeting ? 'Ion Cannon: tap/click target (Esc/right-click cancels)'
      : t.readyBuilding ? 'Structure ready — tap it, then place on map' : !g.has(0, 'cy') ? 'Construction Yard lost!' : 'Tap/drag to select. Right-click (or tap) to command.';
  }
}
const q = s => document.querySelector(s);
