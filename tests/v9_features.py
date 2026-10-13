# v9 checks: four infantry types + abilities, walls / gates / Tiberium Cannon, AI mix, sidebar UI (tabs, ability buttons,
# wall drag placement, gate lock). python tests/v9_features.py http://localhost:8000/ [shotdir]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => {
  const R = {}; const { Game } = await import('./src/engine/game.js'); const { EnemyAI } = await import('./src/ai/enemyAI.js');
  const step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  const fresh = () => { const G = new Game(); G.graceUntil = 0; for (const u of [...G.units]) G.removeQuiet(u); G.fog.enabled = false; return G; };
  const T = 32, X = 40 * T, Y = 40 * T;
  // prerequisites (barracks builds all four; sniper/engineer need a refinery, rocket needs barracks only)
  let G = new Game(); G.teams[0].credits = 9999;
  R.noInfWithoutBarracks = !G.canProduce(0, 'infantry', false);
  G.addBuilding('power', 0, 10, 6).age = 9; G.addBuilding('barracks', 0, 3, 7).age = 9;
  R.riflemanAndRocketWithBarracks = G.canProduce(0, 'infantry', false) && G.canProduce(0, 'rocket', false);
  R.sniperNeedsRefinery = !G.canProduce(0, 'sniper', false) && !G.canProduce(0, 'engineer', false);
  G.addBuilding('refinery', 0, 10, 10).age = 9; R.allFourWithRefinery = ['infantry', 'sniper', 'rocket', 'engineer'].every(k => G.canProduce(0, k, false));
  // Rifleman stim
  G = fresh(); let r = G.spawnUnit('infantry', 0, X, Y); const h0 = r.hp, s0 = r.spd();
  R.stimUsed = r.useAbility() && r.stimT > 0 && r.hp === h0 - 10 && r.spd() > s0 * 1.4; R.stimCooldown = !r.canUse(); step(G, 7); R.stimExpires = !(r.stimT > 0);
  // Sniper: long range, bonus vs infantry, weak vs vehicles; cloak hides it
  G = fresh(); let sn = G.spawnUnit('sniper', 0, X, Y), e1 = G.spawnUnit('infantry', 1, X + 7.5 * T, Y); e1.order = { type: 'move', x: e1.x, y: e1.y };
  e1.stats = { ...e1.stats, range: 1, hp: 2000 }; e1.hp = 2000; let eh = e1.hp; step(G, 3); R.sniperDmgVsInf = Math.round(eh - e1.hp);
  G = fresh(); sn = G.spawnUnit('sniper', 0, X, Y); let tk = G.spawnUnit('tank', 1, X + 7.5 * T, Y); tk.order = { type: 'move', x: tk.x, y: tk.y }; tk.stats = { ...tk.stats, range: 1, hp: 2000 }; tk.hp = 2000;
  eh = tk.hp; step(G, 3); R.sniperDmgVsTank = Math.round(eh - tk.hp); R.sniperBonusVsInf = R.sniperDmgVsInf > 2.5 * R.sniperDmgVsTank;
  const rg = u => u.stats.weapon?.range ?? u.stats.range; R.sniperOutranges = rg(sn) > rg(G.spawnUnit('infantry', 0, 0, 0)) + 2;
  G = fresh(); sn = G.spawnUnit('sniper', 0, X, Y); tk = G.spawnUnit('tank', 1, X + 60, Y);
  R.cloakUsed = sn.useAbility() && sn.cloaked && !tk.canHit(sn); step(G, 9); R.cloakEnds = !sn.cloaked && tk.canHit(sn);
  // Rocket trooper: anti-vehicle + anti-air, dig in
  G = fresh(); let rk = G.spawnUnit('rocket', 0, X, Y); tk = G.spawnUnit('tank', 1, X + 5 * T, Y); tk.order = { type: 'move', x: tk.x, y: tk.y }; tk.stats = { ...tk.stats, range: 1 };
  eh = tk.hp; step(G, 4); R.rocketDmgVsTank4s = Math.round(eh - tk.hp); R.rocketHitsAir = !!rk.stats.weapon?.air || !!rk.stats.air;
  G = fresh(); rk = G.spawnUnit('rocket', 0, X, Y); R.digIn = rk.useAbility() && rk.dug; const rx = rk.x; rk.command({ type: 'attackMove', x: X + 300, y: Y }); rk.dug = true; rk.order = { type: 'attackMove', x: X + 300, y: Y };
  step(G, 1); R.dugCantMove = Math.abs(rk.x - rx) < 1; const rh = rk.hp; rk.damage(40); R.dugHalfDamage = Math.abs((rh - rk.hp) - 20) < 0.5;
  rk.command({ type: 'move', x: X + 200, y: Y }); step(G, 2); R.moveUndigs = !rk.dug && rk.x > rx + 20;
  // Engineer: repairs, captures, demo charge
  G = fresh(); let en = G.spawnUnit('engineer', 0, X, Y); const own = G.spawnUnit('tank', 0, X + 40, Y); own.hp = 200; own.order = { type: 'move', x: own.x, y: own.y };
  step(G, 4); R.engineerRepairs = own.hp > 260; R.engineerNoGun = !en.stats.weapon;
  const pp = G.addBuilding('power', 1, 46, 39); pp.age = 9; en.command({ type: 'capture', target: pp }); step(G, 10); R.captured = pp.team === 0 && en.dead;
  const en2 = G.spawnUnit('engineer', 0, X, Y), fac = G.addBuilding('factory', 1, 34, 37); fac.age = 9; const fh = fac.hp;
  en2.command({ type: 'demo', target: fac }); step(G, 4); R.demoPlanted = G.charges.length === 1 && !en2.dead; step(G, 6); R.demoDamage = Math.round(fh - fac.hp);
  // Walls: cheap instant segments, drag line, auto-connect, block movement
  G = new Game(); G.graceUntil = 0; G.teams[0].credits = 5000; G.fog.enabled = false;
  for (const u of [...G.units]) G.removeQuiet(u);
  const c0 = G.teams[0].credits, line = G.wallLine(13, 4, 13, 12); let placed = 0; for (const [x, y] of line) if (G.placeInstant(0, 'wall', x, y)) placed++;
  R.wallLinePlaced = placed; R.wallCost = c0 - G.teams[0].credits;
  R.wallsConnect = !!G.wallAt(0, 13, 5) && !!G.wallAt(0, 13, 6);
  const tank = G.spawnUnit('tank', 0, 11 * T, 8.5 * T); tank.command({ type: 'move', x: 16 * T, y: 8.5 * T });
  let crossed = false, inside = false; for (let i = 0; i < 6 * 30; i++) { G.update(1/30); if (tank.x > 14 * T + 4 && Math.abs(tank.y - 8.5 * T) < 3 * T) crossed = true; const tx = Math.floor(tank.x / T), ty = Math.floor(tank.y / T); if (G.wallAt(0, tx, ty)) inside = true; }
  R.wallBlocks = !crossed && !inside;
  // Gate: must touch a wall; opens for friendlies, stays shut for enemies, lockable
  R.gateNeedsWall = !G.canPlaceInstant(0, 'gate', 20, 20);
  G.removeQuiet ? 0 : 0; const mid = G.wallAt(0, 13, 8); if (!mid) return R; mid.dead = true; G.buildings = G.buildings.filter(b => !b.dead);
  G.addBuilding('barracks', 0, 3, 11).age = 9; G.addBuilding('power', 0, 10, 2).age = 9; step(G, 0.2);
  const gate = G.placeInstant(0, 'gate', 13, 8); R.gatePlaced = !!gate;
  const gx = 13.5 * T, gy = 8.5 * T; tank.x = 11.5 * T; tank.y = gy; tank.command({ type: 'move', x: 16 * T, y: gy });
  let opened = 0; for (let i = 0; i < 8 * 30; i++) { G.update(1/30); opened = Math.max(opened, gate.openK || 0); }
  R.gateOpensForFriendly = opened > 0.5; R.friendlyPassedGate = tank.x > 13.5 * T;
  const foe = G.spawnUnit('tank', 1, 16 * T, gy); foe.command({ type: 'move', x: 10 * T, y: gy }); tank.x = 30 * T; tank.y = 30 * T; tank.order = null;
  let foeOpen = 0, foeIn = false; for (let i = 0; i < 5 * 30; i++) { foe.hp = foe.stats.hp; G.update(1/30); foeOpen = Math.max(foeOpen, gate.openK || 0); if (foe.x < 13 * T) foeIn = true; }
  R.gateClosedToEnemy = foeOpen < 0.3 && !foeIn; foe.dead = true; G.units = G.units.filter(u => !u.dead);
  gate.locked = true; tank.x = 15.5 * T; tank.y = gy; tank.command({ type: 'move', x: 10 * T, y: gy }); let lockOpen = 0;
  for (let i = 0; i < 4 * 30; i++) { G.update(1/30); lockOpen = Math.max(lockOpen, gate.openK || 0); } R.lockedGateStaysShut = lockOpen < 0.3 && tank.x > 13.5 * T;
  // Tiberium Cannon: needs power, auto-targets ground, fires bolts
  G = fresh(); G.teams[0].credits = 9999; const tu = G.addBuilding('turret', 0, 20, 20); tu.age = 9; step(G, 0.2);
  let et = G.spawnUnit('tank', 1, 20.5 * T + 120, 20.5 * T); et.order = { type: 'move', x: et.x, y: et.y }; et.stats = { ...et.stats, range: 1 };
  let th = et.hp; step(G, 3); R.turretOfflineNoPower = G.teams[0].lowPower && et.hp === th;
  G.addBuilding('power', 0, 10, 6).age = 9; step(G, 0.2); let bolt = false; th = et.hp; for (let i = 0; i < 3 * 30; i++) { G.update(1/30); if (G.effects.some(e => e.bolt)) bolt = true; }
  R.turretFiresWithPower = th - et.hp > 50; R.turretBoltFx = bolt; R.turretNoAir = !tu.stats.weapon.air;
  // Base Walker sprayer melts walls fast
  G = new Game(); G.graceUntil = 0; const cy = G.buildings.find(b => b.team === 0 && b.type === 'cy');
  G.addBuilding('barracks', 0, 3, 7); G.addBuilding('power', 0, 10, 6); G.addBuilding('power', 0, 10, 2); G.addBuilding('factory', 0, 6, 10); for (const b of G.buildings) b.age = 9;
  step(G, 0.1); G.transformBase(0, cy); step(G, 5.4); const rob = G.units.find(u => u.team === 0 && u.carried); for (const u of G.units) if (u.team === 0 && !u.carried) G.removeQuiet(u);
  const ew = G.addBuilding('wall', 1, Math.round(rob.x / T) + 2, Math.round(rob.y / T)); ew.age = 9; const wh = ew.hp; step(G, 1.5);
  R.sprayMeltsWall = ew.dead || wh - ew.hp > 300;
  // AI: builds an infantry mix and a few walls / a gate / turrets
  const A = new Game(); A.graceUntil = 1e9; const ai = new EnemyAI(A, 1); A.teams[1].credits = 20000;
  const seen = new Set(); for (let i = 0; i < 420 * 30; i++) { ai.update(1/30); A.update(1/30); if (i % 30 === 0) for (const u of A.units) if (u.team === 1 && u.stats.inf) seen.add(u.type); }
  R.aiInfantryTypes = [...seen].sort().join(','); R.aiInfMix = seen.size >= 3;
  const cnt = k => A.buildings.filter(b => b.team === 1 && b.type === k).length; R.aiWalls = cnt('wall'); R.aiGates = cnt('gate'); R.aiTurrets = cnt('turret');
  R.aiBuildsDefenses = R.aiWalls >= 3 && R.aiTurrets >= 1;
  return R;
}
"""
def run(p, bname, vname, ctxopt):
    br = getattr(p, bname).launch()
    ctx = br.new_context(**ctxopt); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL + '?autostart=1&grace=0'); page.wait_for_timeout(1500)
    R = page.evaluate(SIM)
    touch = ctxopt.get('has_touch')
    pre = f'{SHOT}/rts-v9-{bname}-{vname}' if SHOT else None
    def scr(x, y): return page.evaluate(f"() => {{ const r = document.getElementById('game').getBoundingClientRect(); return {{ x: r.left + {x} - camera.x, y: r.top + {y} - camera.y }}; }}")
    def tap(sel):
        for i in range(4):  # the action row is rebuilt when the selection changes (units die); retry briefly
            try:
                loc = page.locator(sel); loc.scroll_into_view_if_needed(timeout=3000); loc.tap(timeout=3000) if touch else loc.click(timeout=3000); return
            except Exception:
                if i == 3: raise
                page.wait_for_timeout(150)
    def tapw(x, y):
        pos = scr(x, y)
        if touch: page.touchscreen.tap(pos['x'], pos['y'])
        else: page.mouse.click(pos['x'], pos['y'])
    # set up a base with barracks + refinery so every tab has content
    page.evaluate("""() => { const g = game; g.teams[0].credits = 20000; for (const [k,x,y] of [['power',10,6],['barracks',3,10],['refinery',10,10],['power',10,2]]) g.addBuilding(k,0,x,y).age = 9;
      g.fog.enabled = false; const cy = g.buildings.find(b=>b.team===0&&b.type==='cy'); camera.centerOn(cy.x + 60, cy.y + 60); }""")
    page.wait_for_timeout(400)
    # infantry tab shows 4 slots with icons; queue a sniper
    tap('#buildTabs button[data-tab=infantry]'); page.wait_for_timeout(200)
    R['ui_infSlots'] = page.locator('#buildMenu button').count()
    tap('#buildMenu button[data-key=sniper]'); page.wait_for_timeout(200)
    R['ui_sniperQueued'] = page.evaluate("() => game.teams[0].queues.infantry.some(q => q.key === 'sniper')")
    tap('#buildTabs button[data-tab=defense]'); page.wait_for_timeout(200)
    R['ui_defSlots'] = sorted(page.evaluate("() => [...document.querySelectorAll('#buildMenu button')].map(b => b.dataset.key)"))
    # wall: tap slot, then drag a line on the map
    tap('#buildMenu button[data-key=wall]'); page.wait_for_timeout(100)
    R['ui_wallPlacing'] = page.evaluate("() => ui.placing === 'wall'")
    page.evaluate("() => camera.centerOn(15.5 * 32, 6.5 * 32)"); page.wait_for_timeout(100)
    if not R['ui_wallPlacing']: R['dbg'] = page.evaluate("() => { const b = document.querySelector('#buildMenu button[data-key=wall]'); return [!!b, b && b.disabled, game.canProduce(0,'wall',true), game.teams[0].credits, document.querySelectorAll('#buildMenu button').length]; }")
    a = scr(15.5 * 32, 3.5 * 32); b = scr(15.5 * 32, 9.5 * 32)
    if touch:
        # synthesize a one-finger drag with touch pointer events
        page.evaluate(f"""() => {{ const c = document.getElementById('game'); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, {{ pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 }}));
          ev('pointerdown', {a['x']}, {a['y']}); for (let i = 1; i <= 8; i++) ev('pointermove', {a['x']}, {a['y']} + ({b['y']} - {a['y']}) * i / 8); ev('pointerup', {b['x']}, {b['y']}); }}""")
    else:
        page.mouse.move(a['x'], a['y']); page.mouse.down(); page.mouse.move(b['x'], b['y'], steps=8); page.mouse.up()
    page.wait_for_timeout(200)
    R['ui_wallDragPlaced'] = page.evaluate("() => game.buildings.filter(b => b.team === 0 && b.type === 'wall').length")
    tap('#buildMenu button[data-key=gate]'); page.wait_for_timeout(100)
    page.evaluate("() => { const w = game.wallAt(0, 15, 6); if (w) { w.dead = true; game.buildings = game.buildings.filter(b => !b.dead); } }")
    page.evaluate("() => { ui.hoverTile = { x: 15, y: 6 }; }")
    pg = scr(15.5 * 32, 6.5 * 32)
    if touch: page.touchscreen.tap(pg['x'], pg['y'])
    else: page.mouse.click(pg['x'], pg['y'])
    page.wait_for_timeout(200)
    R['ui_gatePlaced'] = page.evaluate("() => game.buildings.some(b => b.team === 0 && b.type === 'gate')")
    page.evaluate("() => game.buildings.find(b => b.team === 0 && b.type === 'gate') && (ui.placing = null)")
    tapw(15.5 * 32, 6.5 * 32); page.wait_for_timeout(200)
    R['ui_gateSelected'] = page.evaluate("() => [...ui.selection][0]?.type === 'gate'")
    if page.locator('#selActions button[data-act=lock]').count(): tap('#selActions button[data-act=lock]')
    page.wait_for_timeout(100); R['ui_gateLocked'] = page.evaluate("() => !!game.buildings.find(b => b.type === 'gate' && b.team === 0)?.locked")
    # turret via queue, then place next to the wall
    page.evaluate("() => { const t = game.teams[0]; t.queues.building = []; t.readyBuilding = 'turret'; }")
    tap('#buildMenu button[data-key=turret]'); page.wait_for_timeout(100)
    page.evaluate("() => { ui.hoverTile = { x: 17, y: 5 }; ui.place(); }")
    R['ui_turretPlaced'] = page.evaluate("() => game.buildings.some(b => b.team === 0 && b.type === 'turret')")
    # an infantry squad of all four; tap-select via box and use ability buttons
    page.evaluate("""() => { const g = game, T = 32; window._sq = ['infantry','sniper','rocket','engineer'].map((k,i) => g.spawnUnit(k, 0, (19 + i) * T, 12 * T));
      window._foes = [['infantry',27,10],['infantry',28,12],['tank',27,14]].map(([k,x,y]) => { const e = g.spawnUnit(k, 1, (x+30)*T, (y+30)*T); e.order = {type:'move', x:e.x, y:e.y}; e._p = [x*T, y*T]; return e; });
      const eb = g.addBuilding('power', 1, 25, 15); eb.age = 9; window._eb = eb; camera.centerOn(22 * T, 11 * T); }""")
    page.wait_for_timeout(300)
    page.evaluate("() => { ui.selection.clear(); for (const u of _sq) ui.selection.add(u); }"); page.wait_for_timeout(200)
    R['ui_abilityButtons'] = sorted(page.evaluate("() => [...document.querySelectorAll('#selActions button')].map(b => b.dataset.act)"))
    tap('#selActions button[data-act=stim]'); tap('#selActions button[data-act=cloak]'); tap('#selActions button[data-act=digin]')
    R['ui_abilitiesActive'] = page.evaluate("() => _sq[0].stimT > 0 && _sq[1].cloaked && _sq[2].dug")
    tap('#selActions button[data-act=capture]'); R['ui_captureTargeting'] = page.evaluate("() => ui.abilityTarget?.kind === 'capture'")
    ebp = page.evaluate("() => { camera.centerOn(_eb.x, _eb.y); return [_eb.x, _eb.y]; }"); page.wait_for_timeout(100); tapw(*ebp); page.wait_for_timeout(100)
    R['ui_engineerOrdered'] = page.evaluate("() => _sq[3].order?.type === 'capture'")
    page.evaluate("() => { for (const e of _foes) { e.x = e._p[0]; e.y = e._p[1]; e.order = {type:'move', x:e.x, y:e.y}; } camera.centerOn(23*32, 12*32); for (const u of _sq.slice(0,3)) u.command({type:'attackMove', x: 27*32, y: 12*32}); _sq[2].useAbility?.(); }")
    page.wait_for_timeout(1400)
    if pre: page.screenshot(path=f'{pre}-infantry.png')
    page.wait_for_timeout(2500)
    page.evaluate("() => { const g = game; ui.selection.clear(); const t = g.buildings.find(b=>b.type==='turret'&&b.team===0) || {x: 17*32, y: 5*32}; const e = g.spawnUnit('tank', 1, t.x + 150, t.y + 20); e.order = {type:'move', x: e.x, y: e.y};"
                  " const gt = g.buildings.find(b=>b.type==='gate'&&b.team===0); if (gt) { gt.locked = false; g.spawnUnit('tank', 0, gt.x - 60, gt.y).command({type:'move', x: gt.x + 80, y: gt.y}); } camera.centerOn(t.x - 20, t.y + 40); }")
    page.wait_for_timeout(1500)
    if pre: page.screenshot(path=f'{pre}-defenses.png')
    page.evaluate("() => { ui.selection.clear(); tab = null; }")
    tap('#buildTabs button[data-tab=building]'); page.wait_for_timeout(100)
    if pre: page.screenshot(path=f'{pre}-sidebar.png')
    page.wait_for_timeout(2500); R['ui_captureDone'] = page.evaluate("() => _eb.team === 0 || _sq[3].order?.type === 'capture'")
    R['title'] = page.title(); R['menuVersion'] = page.inner_text('#version')
    R['consoleErrors'] = errs
    br.close(); return R

with sync_playwright() as p:
    out = {}
    for bname in ['chromium', 'firefox', 'webkit']:
        for vname, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})),
                           ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if bname == 'firefox' else {'is_mobile': True})))]:
            try: out[f'{bname}-{vname}'] = run(p, bname, vname, opt)
            except Exception as e:
                import traceback; out[f'{bname}-{vname}'] = {'EXCEPTION': str(e)[:300], 'where': traceback.format_exc().splitlines()[-6:-4]}
            if len(sys.argv) > 3: break
        if len(sys.argv) > 3: break
    print(json.dumps(out, indent=1))
