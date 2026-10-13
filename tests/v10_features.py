# v10 checks: factions, reptilian roster + abilities, Brood Ship eggs, buggy/truck ramming, sprites, screenshots.
# python tests/v10_features.py http://localhost:8001/ [shotdir] [one]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8001/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => {
  const R = {}; const { Game } = await import('./src/engine/game.js'); const { BUILDINGS, UNITS } = await import('./src/data/stats.js');
  const T = 32, step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  const fresh = f => { const G = new Game({ factions: f || ['reptile', 'human'] }); G.graceUntil = 0; for (const u of [...G.units]) G.removeQuiet(u); G.fog.enabled = false; G.update(1/30); return G; };
  let G = new Game({ factions: ['reptile', 'human'] });
  R.reptileStartsWithHive = G.buildings.some(b => b.team === 0 && b.type === 'hive') && !G.buildings.some(b => b.team === 0 && b.type === 'cy');
  R.aiIsHuman = G.buildings.some(b => b.team === 1 && b.type === 'cy');
  R.reptileCantBuildHuman = !G.canProduce(0, 'barracks', true) && !G.canProduce(0, 'wall', true);
  R.reptileBuildsOrganic = G.canProduce(0, 'heart', true);
  for (const [k, x, y] of [['heart', 10, 6], ['digester', 10, 10], ['spawnpool', 3, 10], ['dronenest', 14, 2], ['seer', 6, 13], ['heart', 10, 2]]) G.addBuilding(k, 0, x, y).age = 9;
  G.update(1/30); R.rosterInfantry = ['raider', 'spitter', 'brute', 'shaman'].every(k => G.canProduce(0, k, false)); R.rosterDrones = ['spark', 'lance', 'hiveorb'].every(k => G.canProduce(0, k, false) || k === 'hiveorb');
  R.broodNeedsSpire = !G.canProduce(0, 'broodship', false); G.addBuilding('broodspire', 0, 2, 2).age = 9; G.update(1/30); R.broodWithSpire = G.canProduce(0, 'broodship', false);
  R.humanCantBuildReptile = !G.canProduce(1, 'raider', false);
  // abilities
  G = fresh(); const X = 40 * T, Y = 40 * T;
  const tgt = G.spawnUnit('tank', 1, X + 3 * T, Y); tgt.order = { type: 'move', x: tgt.x, y: tgt.y };
  const rd = G.spawnUnit('raider', 0, X, Y); const h0 = tgt.hp; R.leapUsed = rd.useAbility(); step(G, 1.2); R.leapDamage = Math.round(h0 - tgt.hp); R.leapHits = h0 - tgt.hp >= 20;
  const br = G.spawnUnit('brute', 0, X, Y + 3 * T); R.hardenUsed = br.useAbility(); const bh = br.hp; br.damage(100, tgt); R.hardenHalves = Math.round(bh - br.hp) === 50;
  const sp = G.spawnUnit('spitter', 0, X - T, Y); R.acidCast = sp.castAt(X + 3 * T, Y); const h1 = tgt.hp; step(G, 3); R.acidZone = G.zones.length > 0 || h1 > tgt.hp;
  const sh = G.spawnUnit('shaman', 0, X - T, Y + T); br.hp = br.stats.hp * 0.5; const bh2 = br.hp; br.hardT = 0; step(G, 2); R.shamanHeals = br.hp > bh2;
  R.stormCast = sh.castAt(X + 3 * T, Y + T);
  // drones: spark chain, lance beam fire
  G = fresh(); const e1 = G.spawnUnit('infantry', 1, X + 2 * T, Y), e2 = G.spawnUnit('infantry', 1, X + 2.6 * T, Y + 10); for (const e of [e1, e2]) e.order = { type: 'move', x: e.x, y: e.y };
  G.spawnUnit('spark', 0, X, Y); step(G, 2.5); R.sparkChains = e1.hp < e1.stats.hp && e2.hp < e2.stats.hp;
  // Brood Ship eggs: cost, cooldown, max eggs, hatch, temporary hatchlings expire
  G = fresh(); G.teams[0].credits = 1000; const bs = G.spawnUnit('broodship', 0, X, Y); const c0 = G.teams[0].credits;
  R.broodNoGun = !UNITS.broodship.weapon || (UNITS.broodship.weapon.damage || 0) <= 5;
  R.eggOrdered = bs.castAt(X + T, Y + T); step(G, 3); const eggs = G.units.filter(u => u.type === 'egg');
  R.eggLaid = eggs.length === 1; R.eggCost = c0 - G.teams[0].credits; R.eggCooldown = !bs.canUse() && bs.eggCd > 0; R.eggTargetable = eggs[0] && !eggs[0].isAir && eggs[0].hp > 0;
  step(G, 6); const hs = G.units.filter(u => u.type === 'hatchling' && u.team === 0); R.hatchlings = hs.length; R.hatchTemporary = hs.length > 0 && hs.every(h => h.life > 0 && h.lifeMax >= 45 && h.lifeMax <= 60);
  R.eggGoneAfterHatch = !G.units.some(u => u.type === 'egg'); step(G, 55); R.hatchlingsExpire = !G.units.some(u => u.type === 'hatchling');
  { const H = fresh(); H.teams[0].credits = 5000; const b2 = H.spawnUnit('broodship', 0, X, Y); let laid = 0; for (let i = 0; i < 8; i++) { b2.eggCd = 0; if (b2.layEgg(X + i * 10, Y + 40)) laid++; } R.maxEggs = laid; R.maxEggsCapped = laid === UNITS.broodship.maxEggs; }
  { const H = fresh(); const e = H.spawnUnit('broodship', 0, X, Y); e.eggCd = 0; H.teams[0].credits = 1000; e.layEgg(X, Y + 30); const egg = H.units.find(u => u.type === 'egg'); const r = H.spawnUnit('rocket', 1, X + 3 * T, Y + 30); r.command({ type: 'attack', target: egg }); step(H, 4); R.eggKillable = egg.dead && !H.units.some(u => u.type === 'hatchling'); }
  // human buggy / monster truck
  G = fresh(['human', 'reptile']); const tr = G.spawnUnit('truck', 0, X, Y), vic = G.spawnUnit('raider', 1, X + 3 * T, Y); vic.order = { type: 'move', x: vic.x, y: vic.y };
  R.ramUsed = tr.useAbility(); tr.command({ type: 'move', x: X + 6 * T, y: Y }); const v0 = vic.hp; step(G, 1.5); R.ramDamage = Math.round(v0 - Math.max(0, vic.hp)); R.ramHits = vic.dead || v0 - vic.hp >= 50;
  R.truckAllTerrain = !!UNITS.truck.allTerrain && !!UNITS.buggy.allTerrain; R.buggyRearRocket = !!UNITS.buggy.rear && !!UNITS.truck.rear;
  R.buggyBuildable = (() => { const H = new Game(); H.addBuilding('power', 0, 10, 6).age = 9; H.addBuilding('refinery', 0, 10, 10).age = 9; H.addBuilding('factory', 0, 14, 2).age = 9; H.update(1/30); return H.canProduce(0, 'buggy', false) && H.canProduce(0, 'truck', false); })();
  // AI vs AI with mixed factions stays error-free for 4 game minutes
  { const { EnemyAI } = await import('./src/ai/enemyAI.js'); const H = new Game({ factions: ['human', 'reptile'] }); H.graceUntil = 0; const a = new EnemyAI(H, 0), b = new EnemyAI(H, 1);
    for (let i = 0; i < 30 * 240 && !H.over; i++) { H.update(1/30); a.update(1/30); b.update(1/30); } R.aiReptileBuilt = [...new Set(H.buildings.filter(x => x.team === 1).map(x => x.type))].join(','); R.aiReptileArmy = H.units.filter(u => u.team === 1 && !u.harvester).length; R.aiMixedOk = R.aiReptileArmy > 3 || H.over; }
  return R;
}
"""
def run(p, bname, vname, ctxopt):
    br = p.__getattribute__(bname).launch(); ctx = br.new_context(**ctxopt); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL + '?autostart=1&grace=0&faction=reptile'); page.wait_for_timeout(2000)
    R = page.evaluate(SIM)
    pre = f'{SHOT}/rts-v10-{bname}-{vname}' if SHOT else None
    R['spritesLoaded'] = page.evaluate("async () => { const m = await import('./src/engine/sprites.js'); return ['r_raider','r_spitter','r_brute','r_shaman','r_spark','r_lance','r_hive'].filter(n => m.getSprite(n, 0)).length; }")
    R['allReptileSprites'] = R['spritesLoaded'] == 7
    R['menuFactionPick'] = page.locator('input[name=faction]').count() == 2
    R['liveFactionReptile'] = page.evaluate("() => game.teams[0].faction === 'reptile' && game.teams[1].faction === 'human'")
    # reptile army + base screenshot
    page.evaluate("""() => { const g = game, T = 32; g.teams[0].credits = 20000; g.fog.enabled = false;
      for (const [k,x,y] of [['heart',10,6],['digester',10,10],['spawnpool',3,10],['dronenest',14,3],['seer',6,13],['spine',15,8],['broodspire',2,2]]) { const b = g.addBuilding(k, 0, x, y); if (b) b.age = 9; }
      const ks = ['raider','raider','spitter','brute','shaman','spark','lance','hiveorb']; ks.forEach((k, i) => g.spawnUnit(k, 0, (8 + (i % 4) * 1.6) * T, (16 + Math.floor(i / 4) * 1.6) * T));
      const b = g.spawnUnit('broodship', 0, 13 * T, 14 * T); window._bs = b; camera.centerOn(10 * T, 11 * T); }""")
    page.wait_for_timeout(800)
    if pre: page.screenshot(path=f'{pre}-reptile-base.png')
    # sidebar: reptile build menu + brood ship egg button
    page.evaluate("() => { ui.selection.clear(); ui.selection.add(_bs); }"); page.wait_for_timeout(300)
    R['ui_selButtons'] = page.evaluate("() => [...document.querySelectorAll('#selActions button')].map(b => b.dataset.act)")
    R['ui_eggsButton'] = 'eggs' in R['ui_selButtons']
    R['ui_buildMenu'] = page.evaluate("() => [...document.querySelectorAll('#buildMenu button')].map(b => b.dataset.key)")
    R['ui_noHumanBuildings'] = 'barracks' not in R['ui_buildMenu'] and 'heart' in R['ui_buildMenu']
    # battle screenshot: reptiles vs humans, eggs hatching, rockets in flight
    page.evaluate("""() => { const g = game, T = 32, X = 34 * T, Y = 30 * T; g.graceUntil = 0;
      const hs = ['tank','rocket','rocket','rocket','truck','buggy','infantry']; hs.forEach((k, i) => { const u = g.spawnUnit(k, 1, X + 4 * T + (i % 3) * 30, Y + Math.floor(i / 3) * 34 - 30); });
      const rs = ['raider','raider','brute','spitter','shaman','spark','lance']; rs.forEach((k, i) => { const u = g.spawnUnit(k, 0, X - (i % 3) * 30, Y + Math.floor(i / 3) * 34 - 30); u.command({ type: 'attack-move', x: X + 5 * T, y: Y }); });
      const b = g.spawnUnit('broodship', 0, X + T, Y - 2 * T); b.eggCd = 0; g.teams[0].credits = 9000; b.layEgg(X - 1.5 * T, Y + 2.5 * T); b.eggCd = 0; b.layEgg(X - 0.5 * T, Y + 3 * T);
      camera.centerOn(X + 2 * T, Y); }""")
    page.wait_for_timeout(2200)
    if pre: page.screenshot(path=f'{pre}-battle.png')
    page.wait_for_timeout(4500)
    R['ui_hatchedLive'] = page.evaluate("() => game.units.filter(u => u.type === 'hatchling').length")
    if pre: page.screenshot(path=f'{pre}-hatch.png')
    # close-up gallery of the reptilian roster (concept-art sprites) + Brood Ship + egg + human buggy/truck, drawn by the game's own renderer code
    page.evaluate("""async () => { const A = await import('./src/engine/artReptile.js'); const { UNITS } = await import('./src/data/stats.js');
      const c = document.createElement('canvas'); c.id = 'gal'; c.width = 1200; c.height = 330; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#7a6448;width:1200px;height:330px';
      document.body.appendChild(c); const x = c.getContext('2d'); const ks = ['raider','spitter','brute','shaman','spark','lance','hiveorb','broodship','egg','buggy','truck'];
      x.fillStyle = '#9c8058'; x.fillRect(0, 0, 1200, 330);
      ks.forEach((k, i) => { x.save(); const big = k === 'broodship' || k === 'hiveorb'; x.translate(60 + i * 108, big ? 230 : 250); x.scale(big ? 1.4 : 3, big ? 1.4 : 3);
        A.drawFactionUnit(x, { type: k, team: 0, x: 0, y: 0, stats: UNITS[k], hp: UNITS[k].hp, angle: 0, id: i + 1, inc: 3, load: 0, order: null }, 1.0, 0); x.restore();
        x.fillStyle = '#fff'; x.font = '13px sans-serif'; x.fillText(UNITS[k].name, 18 + i * 108, 310); }); }""")
    page.wait_for_timeout(300)
    if pre and vname == 'desktop': page.locator('#gal').screenshot(path=f'{pre}-gallery.png')
    page.evaluate("() => document.getElementById('gal').remove()")
    R['loopAlive'] = page.evaluate("() => new Promise(r => { const t = game.time; setTimeout(() => r(game.time > t), 600); })")
    R['title'] = page.title(); R['consoleErrors'] = errs
    br.close(); return R
with sync_playwright() as p:
    out = {}
    for bname in ['chromium', 'firefox', 'webkit']:
        for vname, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})),
                           ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if bname == 'firefox' else {'is_mobile': True})))]:
            try: out[f'{bname}-{vname}'] = run(p, bname, vname, opt)
            except Exception as e: out[f'{bname}-{vname}'] = {'EXCEPTION': str(e)[:600]}
            if len(sys.argv) > 3: break
        if len(sys.argv) > 3: break
    print(json.dumps(out, indent=1))
