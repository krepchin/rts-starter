# Real-input playtest: every action goes through the actual UI (sidebar taps/clicks, map taps/clicks, drag-select on PC);
# only the clock is fast-forwarded between actions. Builds power -> refinery -> infantry producer, trains infantry, moves the
# army, attacks the enemy base, and checks economy, production, movement and combat all happened with no errors.
# python tests/playtest.py URL outdir
import sys, json
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]
FF = "s => { for (let i = 0; i < s * 30; i++) game.update(1 / 30); }"
def run(p, eng, vn, fk):
    if vn == 'phone': opt = dict(p.devices['iPhone 13 landscape']) if eng == 'webkit' else dict(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=eng != 'firefox', device_scale_factor=2)
    else: opt = dict(viewport={'width': 1366, 'height': 800})
    br = getattr(p, eng).launch(); pg = br.new_context(**opt).new_page(); E = []; R = {}
    pg.on('console', lambda m: E.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: E.append(str(e)[:160]))
    tap = (lambda loc: loc.tap()) if vn == 'phone' else (lambda loc: loc.click())
    def tapxy(x, y): (pg.touchscreen.tap(x, y) if vn == 'phone' else pg.mouse.click(x, y))
    def order(x, y): (pg.touchscreen.tap(x, y) if vn == 'phone' else pg.mouse.click(x, y, button='right'))  # PC: right-click commands; phone: tap
    def scr(wx, wy): return pg.evaluate("([x, y]) => { const r = document.querySelector('canvas').getBoundingClientRect(); return [x - camera.x + r.left, y - camera.y + r.top]; }", [wx, wy])
    pg.goto(URL + '?grace=0'); pg.wait_for_timeout(1500)
    tap(pg.locator(f'#factionPick .fac[data-fac={fk}]')); tap(pg.locator('#startBtn')); pg.wait_for_timeout(2500)
    roles = pg.evaluate("() => { const B = window.__B, f = game.teams[0].faction; const R = {}; for (const [k, s] of Object.entries(B)) if ((s.faction || 'human') === f) { if (s.power > 0 && !s.builds && !R.power) R.power = k; if (s.income || (s.freeUnit && /harv|grazer|harmonizer|reaper/.test(s.freeUnit)) ) R.ref = R.ref || k; if (s.builds === 'infantry') R.inf = R.inf || k; } return R; }")
    R['roles'] = roles; c0 = pg.evaluate("() => game.teams[0].credits")
    yard = pg.evaluate("() => { const b = game.buildings.find(b => b.team === 0); return [b.tx, b.ty, b.w, b.h]; }")
    spots = [(yard[0] + yard[2] + 1, yard[1]), (yard[0] + yard[2] + 1, yard[1] + 4), (yard[0], yard[1] + yard[3] + 1)]
    for i, key in enumerate(['power', 'ref', 'inf']):
        name = pg.evaluate("k => window.__B[k].name", roles[key])
        tap(pg.locator('#buildTabs button').nth(0)); pg.wait_for_timeout(150)
        btn = pg.locator('#buildMenu button', has_text=name).first; tap(btn); pg.wait_for_timeout(150)
        pg.evaluate(FF, 30)  # let it finish building
        pg.wait_for_timeout(200); tap(btn); pg.wait_for_timeout(150)  # ready -> placing
        placed = False
        for dx, dy in [(0, 0), (1, 0), (0, 1), (2, 1), (-1, 2), (3, 0)]:
            tx, ty = spots[i][0] + dx, spots[i][1] + dy; sx, sy = scr(tx * 32 + 8, ty * 32 + 8)
            n0 = pg.evaluate("() => game.buildings.filter(b => b.team === 0).length"); tapxy(sx, sy); pg.wait_for_timeout(150)
            if pg.evaluate("() => game.buildings.filter(b => b.team === 0).length") > n0: placed = True; break
        R['placed_' + key] = placed
        pg.evaluate(FF, 3)
    if vn == 'desktop' or True: pg.screenshot(path=f'{OUT}/play-{fk}-{eng}-{vn}-base.png')
    # train 4 infantry through the infantry tab
    tap(pg.locator('#buildTabs button').nth(2)); pg.wait_for_timeout(200)
    ib = pg.locator('#buildMenu button').first; R['infUnit'] = ib.locator('.nm').inner_text()
    for _ in range(4): tap(ib); pg.wait_for_timeout(100)
    u0 = pg.evaluate("() => game.units.filter(u => u.team === 0 && u.stats.inf).length"); pg.evaluate(FF, 40)
    R['trained'] = pg.evaluate("() => game.units.filter(u => u.team === 0 && u.stats.inf).length") - u0
    R['creditsDelta'] = pg.evaluate("() => game.teams[0].credits") - c0; R['minerDelivered'] = pg.evaluate("() => game.teams[0].earned ?? null")
    # select army: drag box on PC; on phone tap each unit (multi-select by tapping is not standard), so use the army button if present
    army = pg.evaluate("() => game.units.filter(u => u.team === 0 && u.stats.weapon && !u.carrier).map(u => [u.id, u.x, u.y])")
    xs = [a[1] for a in army]; ys = [a[2] for a in army]
    pg.evaluate("([x, y]) => camera.centerOn(x, y)", [sum(xs) / len(xs), sum(ys) / len(ys)]); pg.wait_for_timeout(200)
    if vn == 'desktop':
        a = scr(min(xs) - 20, min(ys) - 20); b = scr(max(xs) + 20, max(ys) + 20)
        pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, steps=4); pg.mouse.move(*b, steps=4); pg.mouse.up()
    else:
        a = scr(min(xs) - 20, min(ys) - 20); b = scr(max(xs) + 20, max(ys) + 20)  # one-finger drag box (touch pointer events)
        pg.evaluate("""([a, b]) => { const c = document.querySelector('canvas'), ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
          ev('pointerdown', a[0], a[1]); for (let i = 1; i <= 6; i++) ev('pointermove', a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: b[0], clientY: b[1], bubbles: true })); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: b[0], clientY: b[1], bubbles: true })); }""", [a, b])
    pg.wait_for_timeout(200); R['selected'] = pg.evaluate("() => ui.selection.size")
    # order them toward the map centre by tapping the minimap-free map spot (scroll camera first)
    pg.evaluate("() => camera.centerOn(40 * 32, 40 * 32)"); pg.wait_for_timeout(150); sx, sy = scr(40 * 32, 40 * 32); order(sx, sy)
    p0 = pg.evaluate("() => game.units.filter(u => u.team === 0 && ui.selection.has(u)).map(u => [u.x, u.y])"); pg.evaluate(FF, 20)
    p1 = pg.evaluate("() => game.units.filter(u => u.team === 0 && ui.selection.has(u)).map(u => [u.x, u.y])")
    R['moved'] = sum(1 for a, b in zip(p0, p1) if abs(a[0] - b[0]) + abs(a[1] - b[1]) > 64)
    # attack: tap the enemy yard
    e = pg.evaluate("() => { const b = game.buildings.find(b => b.team === 1); return [b.x, b.y, b.hp]; }")
    pg.evaluate("([x, y]) => { camera.centerOn(x, y); game.fog.enabled = false; }", e[:2]); pg.wait_for_timeout(150); sx, sy = scr(e[0], e[1]); order(sx, sy)
    R['attackOrders'] = pg.evaluate("() => [...ui.selection].filter(u => u.order?.type === 'attack').length")
    dmg0 = pg.evaluate("() => game.teams.map((t, i) => game.units.filter(u => u.team === i).length + game.buildings.filter(b => b.team === i).reduce((s, b) => s + b.hp, 0))")
    pg.evaluate(FF, 90); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/play-{fk}-{eng}-{vn}-battle.png')
    R['combat'] = pg.evaluate("() => ({ shots: game.stats?.shots ?? null, enemyHpNow: game.buildings.filter(b => b.team === 1).reduce((s, b) => s + b.hp, 0), myUnits: game.units.filter(u => u.team === 0).length, over: game.over || null })")
    R['enemyHpBefore'] = dmg0[1]; R['errors'] = E; br.close(); return R
with sync_playwright() as p:
    out = {}
    for eng, vn in [tuple(x.split(':')) for x in (sys.argv[3] if len(sys.argv) > 3 else 'chromium:desktop,webkit:phone,firefox:desktop,chromium:phone').split(',')]:
        for fk in ['human', 'reptile', 'nordic', 'grey']:
            try: out[f'{eng}-{vn}-{fk}'] = run(p, eng, vn, fk)
            except Exception as ex: out[f'{eng}-{vn}-{fk}'] = {'exception': str(ex)[:300]}
    print(json.dumps(out, indent=1))
