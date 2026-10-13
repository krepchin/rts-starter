import { BUILDINGS, UNITS } from '../data/stats.js?v=9.2.2';
import { CATS, PRODUCER } from '../engine/game.js?v=9.2.2';
import { getSprite } from '../engine/sprites.js?v=9.2.2';
import { drawWall, drawGate, drawTurret, drawTrooper } from '../engine/art9.js?v=9.2.2';

// v9 sidebar: four icon tabs like the painted mock-up: tiberium (base structures), vehicle, infantry, shield (defenses).
const TABS = { building: ['Base structures', '<svg viewBox="0 0 24 24"><path d="M12 2l4 7-4 13-4-13z" fill="#5f5"/><path d="M5 10l3 2-1 7-3-5zM19 10l-3 2 1 7 3-5z" fill="#3c3"/></svg>'],
  vehicle: ['Vehicles & aircraft', '<svg viewBox="0 0 24 24"><rect x="3" y="13" width="18" height="6" rx="3" fill="#9a9"/><rect x="7" y="8" width="9" height="6" rx="1" fill="#bcb"/><rect x="15" y="10" width="7" height="2" fill="#bcb"/></svg>'],
  infantry: ['Infantry', '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3" fill="#bcb"/><path d="M8 9h8l-1 7h-2l-1 6-1-6H9z" fill="#9a9"/></svg>'],
  defense: ['Defenses', '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#9a9"/><path d="M12 5l5 2v4c0 3.5-2.3 6.3-5 7.8z" fill="#5f5"/></svg>'] };
const TAB_CAT = { building: 'building', defense: 'building', infantry: 'infantry', vehicle: 'vehicle' };
const SPR = { cy: 'cy', tank: 'tank_hover', harvester: 'harvester', carrier: 'carrier', infantry: 'soldier' };
// Draw a build-slot icon: sprite thumbnail where we have art, otherwise the painted code art (troopers, walls, gates, turret).
function drawIcon(c, it) {
  const ctx = c.getContext('2d'), W = c.width, H = c.height, k = it.key; ctx.clearRect(0, 0, W, H);
  const name = SPR[k] || (it.isB && !it.s.def ? 'b_' + k : null);
  if (name) { const sp = getSprite(name, 0); if (!sp) return false; const r = Math.min(W / sp.img.width, H / (sp.img.width * sp.aspect)) * 0.95;
    const w = sp.img.width * r, h = sp.img.width * sp.aspect * r; ctx.drawImage(sp.img, (W - w) / 2, (H - h) / 2, w, h); return true; }
  ctx.save();
  if (it.s.inf) { ctx.translate(W / 2, H * 0.92); ctx.scale(1.25, 1.25); drawTrooper(ctx, { type: k, team: 0, aim: 0 }, 0, 24, false, 0); }
  else { const s = it.s, tl = 32, sc = Math.min(W / (s.w * tl + 8), H / (s.h * tl + 18)); ctx.translate(W / 2, H / 2 + 4); ctx.scale(sc, sc); ctx.translate(-s.w * tl / 2, -s.h * tl / 2);
    const fake = { type: k, team: 0, tx: 0, ty: 0, w: s.w, h: s.h, stats: s, hp: s.hp, age: 9, aim: -0.6, openK: 0, powered: true, x: s.w * 16, y: s.h * 16 };
    const g = { wallAt: (tm, x, y) => (k === 'wall' && y === 0 && Math.abs(x) === 1), buildings: [], units: [] };
    (s.wall ? drawWall : s.gate ? drawGate : drawTurret)(ctx, fake, 0, g); }
  ctx.restore(); return true;
}
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
    for (const [k, [label, svg]] of Object.entries(TABS)) {
      const b = document.createElement('button'); b.dataset.tab = k; b.title = label; b.setAttribute('aria-label', label); b.innerHTML = `${svg}<b class="badge"></b>`;
      b.addEventListener('click', () => { if (this.tab !== k) { this.tab = k; this.build(); } }); this.el.tabs.append(b); this.tabBtns[k] = { b, badge: b.querySelector('.badge') };
    }
    this.el.pause.addEventListener('click', () => this.g.togglePause(0, this.cat()));
    this.el.cancel.addEventListener('click', () => { if (this.ui.placing) this.ui.cancel(); else this.g.cancel(0, this.cat()); });
    // Sidebar never shows the browser context menu (long-press on iOS/Android would otherwise pop it / select text).
    q('#sidebar').addEventListener('contextmenu', e => e.preventDefault());
    this.build();
  }
  cat() { const c = TAB_CAT[this.tab]; return c === 'vehicle' && !this.g.teams[0].queues.vehicle.length && this.g.teams[0].queues.aircraft.length ? 'aircraft' : c; }
  items() {
    if (this.tab === 'building' || this.tab === 'defense') return Object.keys(BUILDINGS).filter(k => BUILDINGS[k].buildable !== false && !!BUILDINGS[k].def === (this.tab === 'defense')).map(k => ({ key: k, s: BUILDINGS[k], isB: true }));
    const froms = this.tab === 'vehicle' ? ['vehicle', 'aircraft'] : [this.tab];
    return Object.keys(UNITS).filter(k => froms.includes(UNITS[k].from) && UNITS[k].buildable !== false).map(k => ({ key: k, s: UNITS[k], isB: false }));
  }
  build() { // only on tab switch
    for (const [k, { b }] of Object.entries(this.tabBtns)) setC(b, 'on', k === this.tab);
    this.el.menu.replaceChildren(); this.buttons = [];
    for (const it of this.items()) {
      const b = document.createElement('button'); b.dataset.key = it.key;
      b.title = `${it.s.name} $${it.s.cost}`;
      b.innerHTML = `<canvas class="ic" width="88" height="60"></canvas><span class="nm">${it.s.name}</span><small>$${it.s.cost}</small><b class="count"></b><i class="state"></i><div class="bar"></div>`;
      const ic = b.querySelector('canvas'); ic._ok = drawIcon(ic, it);
      const cat = it.isB ? 'building' : it.s.from;
      let timer = 0, longFired = false, ptype = 'mouse';
      b.addEventListener('pointerdown', e => { ptype = e.pointerType; longFired = false; clearTimeout(timer);
        if (e.pointerType !== 'mouse') timer = setTimeout(() => { longFired = true; this.g.cancel(0, cat, it.key); navigator.vibrate?.(15); }, 550); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(timer));
      b.addEventListener('click', () => { if (longFired) { longFired = false; return; } this.click(it); });
      // Right-click cancels for mouse only; touch long-press is handled by the timer above (no double cancel).
      b.addEventListener('contextmenu', e => { e.preventDefault(); if (ptype === 'mouse') this.g.cancel(0, cat, it.key); });
      this.el.menu.append(b); this.buttons.push({ b, it, ic, count: b.querySelector('.count'), state: b.querySelector('.state'), bar: b.querySelector('.bar') });
    }
  }
  click(it) {
    const t = this.g.teams[0];
    if (it.isB && it.s.instant) { if (this.g.canProduce(0, it.key, true)) this.ui.placing === it.key ? this.ui.cancel() : this.ui.beginPlacing(it.key); return; }
    if (it.isB && t.readyBuilding === it.key) { this.ui.beginPlacing(it.key); return; }
    this.g.enqueue(0, it.key, it.isB);
  }
  update() {
    const g = this.g, t = g.teams[0], el = this.el;
    setT(el.credits, `$${Math.floor(t.credits)}`);
    setT(el.power, `⚡ ${t.powerUsed}/${t.powerMade}`); setC(el.power, 'low', t.lowPower);
    const max = Math.max(t.powerMade, t.powerUsed, 1);
    setW(el.made, pct(t.powerMade / max)); setW(el.used, pct(t.powerUsed / max)); setC(el.used, 'low', t.lowPower);
    const rdyDef = !!t.readyBuilding && !!BUILDINGS[t.readyBuilding].def;
    for (const k of Object.keys(TABS)) {
      const tb = this.tabBtns[k], qn = k === 'vehicle' ? t.queues.vehicle.length + t.queues.aircraft.length : k === 'infantry' ? t.queues.infantry.length
        : t.queues.building.filter(x => !!BUILDINGS[x.key].def === (k === 'defense')).length + (t.readyBuilding && rdyDef === (k === 'defense') ? 1 : 0);
      setT(tb.badge, qn ? String(qn) : ''); setC(tb.b, 'ready', !!t.readyBuilding && rdyDef === (k === 'defense') && TAB_CAT[k] === 'building');
    }
    const cat = this.cat(), qu = t.queues[cat];
    for (const B of this.buttons) {
      const { b, it, count, state, bar } = B; if (!B.ic._ok) B.ic._ok = drawIcon(B.ic, it);
      if (it.isB && it.s.instant) { setD(b, !g.canProduce(0, it.key, true) || t.credits < it.s.cost); setC(b, 'ready', this.ui.placing === it.key); setT(state, this.ui.placing === it.key ? 'PLACE' : ''); setW(bar, '0%'); continue; }
      const qu = t.queues[it.isB ? 'building' : it.s.from];
      const ready = it.isB && t.readyBuilding === it.key, n = qu.filter(x => x.key === it.key).length, head = qu[0]?.key === it.key ? qu[0] : null;
      setD(b, !ready && !n && (!g.canProduce(0, it.key, it.isB) || (it.isB && (qu.length > 0 || !!t.readyBuilding)) || (!it.isB && qu.length >= 5)));
      setC(b, 'ready', ready);
      setT(count, n > 1 || (!it.isB && n) ? String(n) : '');
      setT(state, ready ? 'READY' : head && t.paused[cat] ? 'PAUSED' : head && t.stalled[cat] ? 'HOLD' : '');
      setW(bar, head ? pct(head.progress / head.time) : ready ? '100%' : '0%');
    }
    const hasQ = qu.length > 0;
    setD(el.pause, !hasQ); setT(el.pause, t.paused[cat] ? '▶' : '❚❚'); el.pause.title = t.paused[cat] ? 'Resume queue' : 'Pause queue';
    setD(el.cancel, !hasQ && !(cat === 'building' && t.readyBuilding) && !this.ui.placing);
    setT(el.status, !g.has(0, PRODUCER[cat]) ? (cat === 'building' ? 'No Construction Yard' : `Needs ${BUILDINGS[PRODUCER[cat]].name}`)
      : t.stalled[cat] ? `On hold: ${t.stalled[cat]}` : t.lowPower && hasQ ? 'Low power: slowed' : '');
    setC(q('#radarSweep'), 'off', !(g.has(0, 'radar') && !t.lowPower));
    const pr = t.powerMade ? Math.min(1.5, t.powerMade / Math.max(1, t.powerUsed)) : 0, ang = 180 + (-120 + Math.min(1, pr / 1.5) * 240);
    const dial = q('#scopeDial i'); if (dial._a !== ang) { dial._a = ang; dial.style.transform = `rotate(${ang}deg)`; }
    this.updateSelection(t);
  }
  updateSelection(t) {
    const g = this.g, sel = [...this.ui.selection], one = sel.length === 1 ? sel[0] : null;
    const isB = !!(one && one.kind === 'building' && one.team === 0 && !one.packing);
    const isM = !!(one && one.carried && one.team === 0);
    const abil = !isB && !isM ? [...new Set(sel.filter(u => u.kind === 'unit' && u.team === 0 && u.stats.ability).map(u => u.type))].sort() : [];
    const key = isB ? `b${one.id}` : isM ? `m${one.id}` : abil.length ? 'a' + abil.join() : '';
    if (key !== this.selKey) { // rebuild action buttons only when the selection changes
      this.selKey = key; this.el.actions.replaceChildren(); this.act = {}; this.armed = null;
      const mk = (id, label, fn, title) => { const b = document.createElement('button'); b.textContent = label; b._t = label; b.dataset.act = id; if (title) b.title = title; b.addEventListener('click', fn); this.el.actions.append(b); this.act[id] = b; };
      const AB = { infantry: ['stim', '⚡Stim', 'Stim: faster move + fire for 6 s (costs 10 HP)'], sniper: ['cloak', '◌Cloak', 'Cloak: invisible to enemies for 8 s'],
        rocket: ['digin', '⛉Dig in', 'Dig in: sandbags, +range, half damage, can\'t move'] };
      for (const ty of abil) { if (AB[ty]) mk(AB[ty][0], AB[ty][1], () => { for (const u of this.ui.selection) if (u.type === ty && u.team === 0) u.useAbility(); }, AB[ty][2]);
        if (ty === 'engineer') { mk('capture', '⚑Capture', () => this.ui.beginAbilityTarget('capture'), 'Capture: tap an enemy building (engineer is used up)');
          mk('demo', '✸Demo', () => this.ui.beginAbilityTarget('demo'), 'Demo charge: tap an enemy building (5 s fuse)'); } }
      if (isB) {
        if (one.stats.gate) mk('lock', 'Lock', () => { one.locked = !one.locked; g.sfx?.('servo'); }, 'Lock: keep closed even for your own units');
        mk('repair', 'Repair', () => g.toggleRepair(0, one));
        mk('sell', 'Sell', () => { if (this.armed === one) { g.sell(0, one); this.ui.clearSelection(); this.armed = null; } else { this.armed = one; clearTimeout(this.armT); this.armT = setTimeout(() => this.armed = null, 2500); } });
        if (one.stats.superweapon) mk('fire', 'Fire Ion', () => this.ui.beginTargeting());
        if (one.type === 'cy') {
          mk('pack', 'Pack', () => g.packYard(0, one), 'Fold the yard alone into a slow armored crawler');
          mk('transform', 'Transform', () => g.transformBase(0, one), 'Yard + barracks + power plant + war factory become the Base Walker');
        }
      }
      if (isM) {
        mk('deploy', 'Deploy', () => this.ui.deploying === one ? this.ui.cancel() : this.ui.beginDeploy(one), 'Unfold the base: tap a spot (preview shows the full footprint)');
        if (one.type === 'robot') {
          mk('weapon', '⇄Spray', () => one.toggleMode(), 'Switch weapon: Tiberium sprayer / drill arms');
          mk('burrow', 'Burrow', () => this.ui.burrowing === one ? this.ui.cancel() : this.ui.beginBurrow(one), 'Drill mode: dig under and erupt at a target spot');
        }
      }
      setC(this.el.actions, 'has', Object.keys(this.act).length > 0); setC(this.el.actions, 'two', Object.keys(this.act).length > 3);
    }
    if (isM) {
      const busy = one.busy, A = this.act;
      setD(A.deploy, busy); setT(A.deploy, this.ui.deploying === one ? 'Place' : one.state === 'deploying' ? 'Unfold' : 'Deploy'); setC(A.deploy, 'on', this.ui.deploying === one);
      if (A.weapon) { setT(A.weapon, one.mode === 'spray' ? '⇄Spray' : '⇄Drill'); setD(A.weapon, busy); setC(A.weapon, 'on', one.swapT > 0); }
      if (A.burrow) { setD(A.burrow, !one.canBurrow() && this.ui.burrowing !== one);
        setT(A.burrow, this.ui.burrowing === one ? 'Target' : one.state === 'under' ? 'Digging' : one.burrowCd > 0 ? `⏳${Math.ceil(one.burrowCd)}s` : 'Burrow'); setC(A.burrow, 'on', this.ui.burrowing === one); }
      const names = one.carried.map(c => BUILDINGS[c.type].name.replace('Construction ', '')).join(', ');
      const st = { rising: 'Assembling…', ready: one.type === 'robot' ? (one.mode === 'spray' ? 'Weapon: Tiberium sprayer' : 'Weapon: drill arms') : 'Packed: move, then Deploy',
        deploying: 'Unfolding base…', burrowing: 'Burrowing…', under: 'Underground (untargetable)', emerging: 'Erupting!' }[one.state];
      setT(this.el.info, `${one.stats.name}\nHP ${Math.ceil(one.hp)}/${one.stats.hp} · Carries: ${names}\n${this.ui.deploying === one ? 'Tap map to deploy (right-click/Esc cancels)' : this.ui.burrowing === one ? 'Tap a spot to burrow to' : st} · no production`);
      return;
    }
    if (abil.length) { const A = this.act, us = sel.filter(u => u.kind === 'unit' && u.team === 0);
      const st = (ty, on) => { const l = us.filter(u => u.type === ty); return { on: l.some(on), ready: l.some(u => u.canUse()), cd: Math.min(...l.map(u => u.abCd || 0)) }; };
      if (A.stim) { const r = st('infantry', u => u.stimT > 0); setC(A.stim, 'on', r.on); setD(A.stim, !r.ready); setT(A.stim, r.on ? '⚡Stimmed' : r.ready ? '⚡Stim' : `⏳${Math.ceil(r.cd)}s`); }
      if (A.cloak) { const r = st('sniper', u => u.cloaked); setC(A.cloak, 'on', r.on); setD(A.cloak, !r.ready); setT(A.cloak, r.on ? '◌Hidden' : r.ready ? '◌Cloak' : `⏳${Math.ceil(r.cd)}s`); }
      if (A.digin) { const r = st('rocket', u => u.dug); setC(A.digin, 'on', r.on); setD(A.digin, !r.ready); setT(A.digin, r.on ? '⛉Dig out' : '⛉Dig in'); }
      if (A.capture) { const T = this.ui.abilityTarget?.kind; setC(A.capture, 'on', T === 'capture'); setC(A.demo, 'on', T === 'demo');
        const cd = Math.min(...us.filter(u => u.type === 'engineer').map(u => u.abCd || 0)); setD(A.demo, cd > 0); setT(A.demo, cd > 0 ? `⏳${Math.ceil(cd)}s` : '✸Demo'); }
      setT(this.el.info, (one ? `${one.stats.name}\nHP ${Math.ceil(one.hp)}/${one.stats.hp}` : `${sel.length} selected`) +
        (this.ui.abilityTarget ? '\nTap an enemy building' : one?.type === 'engineer' ? '\nRepairs nearby units/buildings (tap a damaged vehicle to fix it)' : one?.type === 'medic' ? '\nHeals nearby infantry (tap a soldier to treat it)' : one?.type === 'bomber' ? '\nStealthed. Attack a ground target for a bomb run' : ''));
      return;
    }
    if (isB) {
      const s = one.stats;
      if (this.act.lock) { setT(this.act.lock, one.locked ? 'Unlock' : 'Lock'); setC(this.act.lock, 'on', !!one.locked); }
      setT(this.act.repair, one.repairing ? 'Repairing' : 'Repair'); setC(this.act.repair, 'on', one.repairing); setD(this.act.repair, one.hp >= s.hp && !one.repairing);
      setT(this.act.sell, this.armed === one ? `+$${Math.floor((s.cost || 0) * 0.5 * one.hp / s.hp)}?` : 'Sell'); setC(this.act.sell, 'armed', this.armed === one);
      if (this.act.fire) { const f = one.charge / s.superweapon.chargeTime; setD(this.act.fire, !g.superReady(0)); setT(this.act.fire, this.ui.targeting ? 'Target…' : f >= 1 ? 'FIRE' : `⚡${Math.floor(f * 100)}%`); }
      if (this.act.pack) { const ok = g.canMorph(0, one); setD(this.act.pack, !ok); setD(this.act.transform, !ok); }
      const lines = [`${s.name}`, `HP ${Math.ceil(one.hp)}/${s.hp} · Power ${s.power > 0 ? '+' : ''}${s.power}`];
      if (!one.powered && (s.weapon || s.radar || s.superweapon)) lines.push('OFFLINE: low power');
      else if (s.builds && s.builds !== 'building') lines.push('Tap map: set rally point');
      else if (one.type === 'cy') lines.push(`Transform takes: ${g.transformParts(one).map(b => b.stats.name.split(' ')[0]).join(', ')}`);
      setT(this.el.info, lines.join('\n'));
      return;
    }
    if (one?.packing) { setT(this.el.info, `${one.stats.name}\nPacking up… (offline)`); return; }
    setT(this.el.info, one ? `${one.stats.name}\nHP ${Math.ceil(one.hp)}/${one.stats.hp}` +
      (one.type === 'carrier' ? `\nInterceptors docked: ${one.docked}` : '') + (one.type === 'harvester' ? `\nLoad ${one.load | 0}` : '')
      : sel.length ? `${sel.length} selected` : this.ui.targeting ? 'Ion Cannon: tap a target (right-click/Esc cancels)'
      : this.ui.placing && BUILDINGS[this.ui.placing].wall ? 'Tap a tile, or drag a line of wall ($50 each)' : this.ui.placing && BUILDINGS[this.ui.placing].gate ? 'Tap a tile next to a wall'
      : t.readyBuilding ? 'Structure ready: tap it, then place on map' : !g.has(0, 'cy') ? 'Construction Yard lost!' : 'Tap/drag to select. Tap (or right-click) to command.');
  }
}
const q = s => document.querySelector(s);
