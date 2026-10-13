# v9.1 checks: wall/gate durability (bounded break times), Dropship load/unload/cloak/detection, painted rockets, sound engine.
# python tests/v91_features.py http://localhost:8000/ [shotdir] [one]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => {
  const R = {}; const { Game } = await import('./src/engine/game.js'); const { BUILDINGS } = await import('./src/data/stats.js');
  const T = 32, step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  const fresh = () => { const G = new Game(); G.graceUntil = 0; for (const u of [...G.units]) G.removeQuiet(u); G.fog.enabled = false; G.update(1/30); return G; };
  R.wallHp = BUILDINGS.wall.hp; R.gateHp = BUILDINGS.gate.hp; R.wall4x = BUILDINGS.wall.hp === 1800; R.gate4x = BUILDINGS.gate.hp === 3200;
  // time for attackers to break a target (seconds, capped)
  const breakTime = (type, kinds, cap) => { const G = fresh(); const w = G.addBuilding(type, 1, 40, 40); w.age = 9;
    kinds.forEach((k, i) => { const u = G.spawnUnit(k, 0, 40.5 * T - 4.2 * T, 40.5 * T + (i - 1) * 14); u.command({ type: 'attack', target: w }); });
    let s = 0; while (!w.dead && s < cap) { G.update(1/30); s += 1/30; } return { t: Math.round(s * 10) / 10, dead: w.dead, left: Math.round(w.hp) }; };
  const r3 = breakTime('wall', ['rocket', 'rocket', 'rocket'], 120); R.wall3Rockets = r3; R.wall3RocketsIn20to40 = r3.dead && r3.t >= 20 && r3.t <= 40;
  const g3 = breakTime('gate', ['rocket', 'rocket', 'rocket'], 150); R.gate3Rockets = g3; R.gateBreaks = g3.dead;
  const tk = breakTime('wall', ['tank'], 150); R.wall1Tank = tk; R.tankBreaksWall = tk.dead;
  const rf = breakTime('wall', ['infantry'], 60); R.wall1Rifle60s = rf; const rdps = (1800 - rf.left) / 60; R.rifleEstSeconds = Math.round(1800 / rdps);
  R.rifleSlowButFinite = !rf.dead && rdps > 0 && R.rifleEstSeconds > 600;
  // walker sprayer vs wall
  { const G = new Game(); G.graceUntil = 0; const cy = G.buildings.find(b => b.team === 0 && b.type === 'cy');
    G.addBuilding('barracks', 0, 3, 7); G.addBuilding('power', 0, 10, 6); G.addBuilding('power', 0, 10, 2); G.addBuilding('factory', 0, 6, 10); for (const b of G.buildings) b.age = 9;
    step(G, 0.1); G.transformBase(0, cy); step(G, 5.4); const rob = G.units.find(u => u.team === 0 && u.carried); for (const u of G.units) if (u.team === 0 && !u.carried) G.removeQuiet(u);
    const w = G.addBuilding('wall', 1, Math.round(rob.x / T) + 2, Math.round(rob.y / T)); w.age = 9; let s = 0; while (!w.dead && s < 60) { G.update(1/30); s += 1/30; }
    R.walkerSprayWall = Math.round(s * 10) / 10; R.walkerBreaksWall = w.dead; }
  // Dropship
  let G = new Game(); G.teams[0].credits = 9999; R.dropshipNeedsAirfield = !G.canProduce(0, 'dropship', false);
  G.addBuilding('power', 0, 10, 6).age = 9; G.addBuilding('refinery', 0, 10, 10).age = 9; G.addBuilding('factory', 0, 14, 2).age = 9; G.addBuilding('airfield', 0, 2, 13).age = 9;
  R.dropshipWithAirfield = G.canProduce(0, 'dropship', false);
  G = fresh(); const X = 40 * T, Y = 40 * T; const ds = G.spawnUnit('dropship', 0, X, Y);
  const inf = [0, 1, 2, 3].map(i => G.spawnUnit(i % 2 ? 'rocket' : 'infantry', 0, X - 60 - i * 12, Y + 30));
  const tank = G.spawnUnit('tank', 0, X + 60, Y + 30), extra = G.spawnUnit('infantry', 0, X, Y + 70), harv = G.spawnUnit('harvester', 0, X + 50, Y - 50);
  for (const u of [...inf, tank]) u.command({ type: 'board', target: ds }); step(G, 6);
  R.loadedCount = ds.cargo.length; R.slotsUsed = ds.used; R.cargoFull8 = ds.used === 8 && inf.every(u => u.inside === ds) && tank.inside === ds;
  R.ninthRejected = !ds.canTake(extra); R.harvesterCantBoard = !ds.canTake(harv);
  R.cargoNotInWorld = !G.units.includes(tank);
  // cloak + detection
  const foe = G.spawnUnit('rocket', 1, X + 90, Y); foe.order = { type: 'move', x: foe.x, y: foe.y };
  R.cloakOn = ds.useAbility() && ds.cloaked; step(G, 0.5); R.cloakedUntargetable = !foe.canHit(ds) && !ds.detected; const e0 = ds.energy; step(G, 2); R.cloakDrains = ds.energy < e0 - 10;
  G.addBuilding('power', 1, 70, 70).age = 9; const tu = G.addBuilding('turret', 1, 43, 39); tu.age = 9; step(G, 0.5); R.turretDetects = ds.detected && foe.canHit(ds);
  tu.dead = true; G.buildings = G.buildings.filter(b => !b.dead); foe.dead = true; step(G, 0.5); R.undetectedAfter = !ds.detected;
  // unload: few seconds, breaks cloak, units placed near the target
  const tx = 55 * T, ty = 40 * T; ds.unloadAt(tx, ty); let tArr = null, tDone = null, s = 0;
  while (s < 25 && (ds.cargo.length || tDone === null)) { G.update(1/30); s += 1/30; if (tArr === null && Math.hypot(ds.x - tx, ds.y - ty) <= 10) tArr = s; if (tArr !== null && !ds.cargo.length && tDone === null) tDone = s; }
  R.unloadSeconds = tDone !== null ? Math.round((tDone - tArr) * 10) / 10 : null; R.unloadFewSeconds = R.unloadSeconds !== null && R.unloadSeconds >= 1 && R.unloadSeconds <= 5;
  R.unloadBreaksCloak = !ds.cloaked && ds.cloakCd > 0; R.unloadedNearTarget = [...inf, tank].every(u => !u.dead && G.units.includes(u) && Math.hypot(u.x - tx, u.y - ty) < 3 * T);
  // walker can't board
  { const H = new Game(); const c = H.buildings[0]; H.packYard(0, c); step(H, 3); const m = H.units.find(u => u.carried); const d2 = H.spawnUnit('dropship', 0, m.x + 40, m.y); R.walkerCantBoard = !d2.canTake(m); }
  // painted rockets: projectile in flight, impact flash/debris, scorch decal
  G = fresh(); const rk = G.spawnUnit('rocket', 0, X, Y), et = G.spawnUnit('tank', 1, X + 150, Y); et.order = { type: 'move', x: et.x, y: et.y }; et.stats = { ...et.stats, range: 1 };
  let inFlight = 0, flash = false, smoke = 0; for (let i = 0; i < 90; i++) { G.update(1/30); inFlight = Math.max(inFlight, G.rockets.length); if (G.effects.some(e => e.flash)) flash = true; smoke = Math.max(smoke, G.effects.filter(e => e.smoke).length); }
  R.rocketProjectile = inFlight > 0; R.rocketImpactFlash = flash; R.rocketSmokeTrail = smoke >= 4; R.scorchDecal = G.decals.length > 0;
  return R;
}
"""
def run(p, bname, vname, ctxopt):
    br = getattr(p, bname).launch()
    ctx = br.new_context(**ctxopt); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL + '?autostart=1&grace=0'); page.wait_for_timeout(1500)
    R = page.evaluate(SIM); RR = R
    try: return ui_part(page, R, bname, vname, ctxopt, errs, br)
    except Exception as e: R['EXCEPTION'] = str(e)[:400]; br.close(); return R
def ui_part(page, R, bname, vname, ctxopt, errs, br):
    if True:
        touch = ctxopt.get('has_touch')
        pre = f'{SHOT}/rts-v91-{bname}-{vname}' if SHOT else None
        def scr(x, y): return page.evaluate(f"() => {{ const r = document.getElementById('game').getBoundingClientRect(); return {{ x: r.left + {x} - camera.x, y: r.top + {y} - camera.y }}; }}")
        def tap(sel):
            for i in range(4):
                try:
                    loc = page.locator(sel); loc.scroll_into_view_if_needed(timeout=3000); loc.tap(timeout=3000) if touch else loc.click(timeout=3000); return
                except Exception:
                    if i == 3: raise
                    page.wait_for_timeout(150)
        def tapw(x, y):
            pos = scr(x, y)
            if touch: page.touchscreen.tap(pos['x'], pos['y'])
            else: page.mouse.click(pos['x'], pos['y'])
        page.evaluate("""() => { const g = game; g.teams[0].credits = 20000; for (const [k,x,y] of [['power',10,6],['refinery',10,10],['factory',14,2],['airfield',2,13],['power',10,2],['barracks',3,10]]) { const b = g.addBuilding(k,0,x,y); if (b) b.age = 9; }
          g.fog.enabled = false; }""")
        page.wait_for_timeout(300)
        tap('#buildTabs button[data-tab=vehicle]'); page.wait_for_timeout(200)
        R['ui_dropshipSlot'] = page.locator('#buildMenu button[data-key=dropship]').count() == 1
        tap('#buildMenu button[data-key=dropship]'); R['ui_dropshipQueued'] = page.evaluate("() => game.teams[0].queues.aircraft.some(q => q.key === 'dropship')")
        page.evaluate("""() => { const g = game, T = 32; window._ds = g.spawnUnit('dropship', 0, 20 * T, 8 * T); window._sq = [0,1,2].map(i => g.spawnUnit(['infantry','rocket','sniper'][i], 0, (17 + i) * T, 10 * T));
          ui.selection.clear(); for (const u of _sq) ui.selection.add(u); camera.centerOn(19 * T, 9 * T); }""")
        page.wait_for_timeout(200)
        dsp = page.evaluate("() => [_ds.x, _ds.y]"); tapw(*dsp); page.wait_for_timeout(200)
        R['ui_tapDropshipBoards'] = page.evaluate("() => _sq.every(u => u.order?.type === 'board' || u.inside === _ds)")
        page.wait_for_timeout(3500); R['ui_boarded'] = page.evaluate("() => _ds.cargo.length")
        page.evaluate("() => { ui.selection.clear(); ui.selection.add(_ds); }"); page.wait_for_timeout(200)
        R['ui_dropshipButtons'] = sorted(page.evaluate("() => [...document.querySelectorAll('#selActions button')].map(b => b.dataset.act)"))
        tap('#selActions button[data-act=dcloak]'); R['ui_cloaked'] = page.evaluate("() => _ds.cloaked")
        tap('#selActions button[data-act=unload]'); R['ui_unloadTargeting'] = page.evaluate("() => ui.unloading === _ds")
        page.evaluate("() => camera.centerOn(22 * 32, 9 * 32)"); page.wait_for_timeout(100)
        tapw(23 * 32, 11 * 32); page.wait_for_timeout(200); R['ui_unloadOrdered'] = page.evaluate("() => _ds.order?.type === 'unload'")
        page.wait_for_timeout(900)
        if pre: page.screenshot(path=f'{pre}-dropship.png')
        page.wait_for_timeout(3000); R['ui_unloaded'] = page.evaluate("() => _ds.cargo.length === 0")
        # rockets + wall siege screenshot
        page.evaluate("""() => { const g = game, T = 32; for (let y = 3; y <= 9; y++) g.placeInstant(1, 'wall', 30, y);
          for (let y = 3; y <= 9; y++) { const b = g.addBuilding('wall', 1, 30, y); if (b) b.age = 9; }
          for (let i = 0; i < 4; i++) g.spawnUnit('rocket', 0, 25 * T, (4 + i * 1.5) * T).command({ type: 'attack', target: g.buildings.find(b => b.type === 'wall' && b.team === 1 && b.ty === 4 + i) || g.buildings.find(b => b.type === 'wall' && b.team === 1) });
          camera.centerOn(27.5 * T, 6.5 * T); }""")
        page.wait_for_timeout(2600)
        if pre: page.screenshot(path=f'{pre}-rockets.png')
        # sound engine (needs the first tap, which happened above)
        page.wait_for_timeout(800)
        snd = page.evaluate("""() => { const s = sound; for (let i = 0; i < 40; i++) s.play('rifle'); s.play('voice:move', { type: 'tank' }); s.play('boom_l'); s.play('alert:base');
          return { ctx: !!s.ctx, state: s.ctx?.state, samples: s.stats.samples, dropped: s.stats.dropped, ducks: s.stats.ducks, buses: !!(s.musicBus && s.sfxBus && s.ambBus && s.voiceBus && s.reverb && s.comp) }; }""")
        R['sound'] = snd
        R['sound_samplesLoaded'] = snd['samples'] >= 30
        R['sound_limiterDrops'] = snd['dropped'] > 0 or snd['state'] != 'running'
        R['sound_busesAndReverb'] = snd['buses']
        R['music_running'] = page.evaluate("() => sound.ctx?.state !== 'running' || sound.step > 10")
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
                import traceback; out[f'{bname}-{vname}'] = {'EXCEPTION': str(e)[:400]}
            if len(sys.argv) > 3: break
        if len(sys.argv) > 3: break
    print(json.dumps(out, indent=1))
