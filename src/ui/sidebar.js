import { BUILDINGS, UNITS } from '../data/stats.js';

// DOM sidebar: credits/power HUD, tabbed build menu, selection info.
export class Sidebar {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.tab = 'building';
    this.el = { credits: q('#credits'), power: q('#power'), tabs: q('#buildTabs'), menu: q('#buildMenu'), info: q('#selInfo') };
    const tabs = { building: 'Base', infantry: 'Inf', vehicle: 'Veh', aircraft: 'Air' };
    for (const [k, label] of Object.entries(tabs)) {
      const b = document.createElement('button'); b.textContent = label; b.dataset.tab = k;
      b.addEventListener('click', () => { this.tab = k; this.build(); }); this.el.tabs.append(b);
    }
    this.build();
  }
  items() {
    if (this.tab === 'building') return Object.keys(BUILDINGS).filter(k => k !== 'cy').map(k => ({ key: k, s: BUILDINGS[k], isB: true }));
    return Object.keys(UNITS).filter(k => UNITS[k].from === this.tab).map(k => ({ key: k, s: UNITS[k], isB: false }));
  }
  build() {
    for (const b of this.el.tabs.children) b.classList.toggle('on', b.dataset.tab === this.tab);
    this.el.menu.replaceChildren(); this.buttons = [];
    for (const it of this.items()) {
      const b = document.createElement('button'); b.innerHTML = `${it.s.name}<br><small>$${it.s.cost}</small><div class="bar"></div>`;
      b.addEventListener('click', () => this.click(it));
      b.addEventListener('contextmenu', e => { e.preventDefault(); this.g.cancelProduction(0, it.isB ? 'building' : it.s.from); });
      this.el.menu.append(b); this.buttons.push({ b, it });
    }
  }
  click(it) {
    const t = this.g.teams[0];
    if (it.isB && t.readyBuilding === it.key) { this.ui.beginPlacing(it.key); return; }
    this.g.startProduction(0, it.key, it.isB);
  }
  update() {
    const t = this.g.teams[0];
    this.el.credits.textContent = `$${Math.floor(t.credits)}`;
    this.el.power.textContent = `⚡ ${t.powerUsed}/${t.powerMade}`; this.el.power.classList.toggle('low', t.powerUsed > t.powerMade);
    for (const { b, it } of this.buttons) {
      const cat = it.isB ? 'building' : it.s.from, q = t.queues[cat];
      const ready = it.isB && t.readyBuilding === it.key;
      b.disabled = !this.g.canProduce(0, it.key, it.isB) || (!ready && (q && q.key !== it.key || t.credits < it.s.cost && !q));
      b.classList.toggle('ready', ready);
      b.querySelector('.bar').style.width = q && q.key === it.key ? `${q.progress / q.time * 100}%` : ready ? '100%' : '0';
    }
    const sel = [...this.ui.selection];
    this.el.info.textContent = sel.length === 1 ? `${sel[0].stats.name}\nHP ${Math.ceil(sel[0].hp)}/${sel[0].stats.hp}` +
      (sel[0].type === 'carrier' ? `\nInterceptors docked: ${sel[0].docked}` : '') + (sel[0].type === 'harvester' ? `\nLoad ${sel[0].load | 0}` : '')
      : sel.length ? `${sel.length} selected` : (t.readyBuilding ? 'Building ready — click it, then place on map' : 'Tap/drag to select. Right-click (or tap) to command.');
  }
}
const q = s => document.querySelector(s);
