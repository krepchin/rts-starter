# v10.1: faction selection screen -> each of the 4 factions into gameplay, plus an AI-vs-AI soak per faction (errors, abilities).
# python tests/v101_factions.py http://localhost:8795/ /workspace/renders
import sys, json
from playwright.sync_api import sync_playwright
URL, SHOT = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
FK = ['human', 'reptile', 'nordic', 'grey']
SOAK = r"""
async (fk) => { const { Game } = await import('./src/engine/game.js?v=10.1'); const { EnemyAI } = await import('./src/ai/enemyAI.js?v=10.1'); const { UNITS, BUILDINGS } = await import('./src/data/stats.js?v=10.1');
  const R = {}; const others = ['human','reptile','nordic','grey'].filter(f => f !== fk);
  for (const o of others) { const G = new Game({ factions: [fk, o] }); G.graceUntil = 0; G.teams[0].credits = G.teams[1].credits = 20000; G.fog.enabled = false;
    const a = new EnemyAI(G, 0), b = new EnemyAI(G, 1); let err = null;
    try { for (let i = 0; i < 360 * 15; i++) { a.update(1/15); b.update(1/15); G.update(1/15); if (G.over) break; } } catch (e) { err = String(e).slice(0, 160); }
    const types = new Set(G.units.filter(u => u.team === 0).map(u => u.type)), bt = new Set(G.buildings.filter(x => x.team === 0).map(x => x.type));
    R[o] = { err, units: [...types].join(','), buildings: bt.size, over: G.over || null }; }
  // abilities sanity
  const G = new Game({ factions: [fk, others[0]] }); G.graceUntil = 0; G.fog.enabled = false; for (const u of [...G.units]) G.removeQuiet(u);
  const ab = {}; for (const k of Object.keys(UNITS)) if ((UNITS[k].faction || 'human') === fk && UNITS[k].ability && UNITS[k].buildable !== false) {
    const u = G.spawnUnit(k, 0, 1200, 1200), e = G.spawnUnit(others[0] === 'human' ? 'infantry' : 'infantry', 1, 1260, 1200); e.order = { type: 'move', x: e.x, y: e.y }; u.target = e;
    let ok; try { ok = u.useAbility(); } catch (x) { ok = 'ERR ' + x; } ab[k] = ok; G.removeQuiet(u); G.removeQuiet(e); }
  R.abilities = ab; return R; }
"""
def run(p, bn, vn, opt):
    br = getattr(p, bn).launch(); ctx = br.new_context(**opt); pg = ctx.new_page(); E = []
    pg.on('pageerror', lambda e: E.append('PAGEERR ' + str(e)[:200])); pg.on('console', lambda m: E.append(m.text[:200]) if m.type == 'error' else None)
    pg.on('response', lambda r: E.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    R = {}
    for fk in FK:
        pg.goto(URL + '?grace=0'); pg.wait_for_timeout(1500)
        if fk == 'human' and SHOT: pg.screenshot(path=f'{SHOT}/factions-{bn}-{vn}.png', full_page=True)
        card = pg.locator(f'#factionPick .fac[data-fac={fk}]'); card.scroll_into_view_if_needed()
        (card.tap() if vn == 'phone' else card.click()); pg.wait_for_timeout(200)
        sel = pg.evaluate("() => document.querySelector('input[name=faction]:checked')?.value")
        b = pg.locator('#startBtn'); b.scroll_into_view_if_needed(); (b.tap() if vn == 'phone' else b.click()); pg.wait_for_timeout(4500)
        st = pg.evaluate("() => ({ menu: !document.getElementById('startMenu').hidden, me: game.teams[0].faction, ai: game.teams[1].faction, t: game.time, mine: game.units.filter(u => u.team === 0).map(u => u.type).join(','), saved: localStorage.getItem('tiberium.faction'), tabs: document.querySelectorAll('#buildMenu button').length })")
        st['picked'] = sel; R[fk] = st
        if SHOT: pg.evaluate("() => camera.centerOn(9 * 32, 9 * 32)"); pg.wait_for_timeout(500); pg.screenshot(path=f'{SHOT}/faction-{fk}-{bn}-{vn}.png')
    pg.goto(URL); pg.wait_for_timeout(1200); R['rememberedAfterReload'] = pg.evaluate("() => document.querySelector('input[name=faction]:checked')?.value")
    if vn == 'desktop' and bn == 'chromium':
        for fk in FK: R['soak_' + fk] = pg.evaluate(SOAK, fk)
    R['errors'] = E[:10]; br.close(); return R
with sync_playwright() as p:
    out = {}
    for bn in ['chromium', 'firefox', 'webkit']:
        for vn, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})), ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if bn == 'firefox' else {'is_mobile': True})))]:
            try: out[f'{bn}-{vn}'] = run(p, bn, vn, opt)
            except Exception as e: out[f'{bn}-{vn}'] = {'EXCEPTION': str(e)[:400]}
            if len(sys.argv) > 3: break
        if len(sys.argv) > 3: break
    print(json.dumps(out, indent=1))
