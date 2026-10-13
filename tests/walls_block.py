# v9.2.3 hotfix: ground units never enter wall / closed-gate tiles (any tick); aircraft fly over. Long/short range, both sides, groups.
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => { const v = [...document.scripts].map(s => s.src).find(s => s.includes('main.js')).split('?')[1];
  const { Game } = await import('./src/engine/game.js?' + v); const T = 32, R = {};
  const mk = () => { const G = new Game(); G.graceUntil = 1e9; G.fog.enabled = false; for (const u of [...G.units]) G.removeQuiet(u); G.teams[0].credits = G.teams[1].credits = 1e6;
    for (let y = 30; y <= 50; y++) G.addBuilding(y === 40 ? 'gate' : 'wall', 0, 40, y).age = 9; return G; }   // vertical wall x=40, y 30..50, gate at y=40 (team 0)
  const inSolid = (G, u) => { const b = G.buildings.find(b => !b.dead && (b.stats.wall || b.stats.gate) && Math.floor(u.x / T) === b.tx && Math.floor(u.y / T) === b.ty);
    return !!b && !(b.stats.gate && b.team === u.team && (b.openK || 0) > 0.5); };
  const run = (name, specs, secs, lockGate) => { const G = mk(); if (lockGate) G.buildings.find(b => b.stats.gate).locked = true; const us = [];
    for (const [k, team, x, y, tx, ty] of specs) { const u = G.spawnUnit(k, team, x * T, y * T); u.command(k === 'harvester' ? { type: 'move', x: tx * T, y: ty * T } : { type: 'move', x: tx * T, y: ty * T }); if (k === 'harvester') u.update = ((f) => function (dt) { this.order = this.order || null; return f.call(this, dt); })(u.update); us.push([u, tx * T, ty * T]); }
    let viol = 0, crossed = 0; for (let i = 0; i < secs * 30; i++) { G.update(1 / 30); for (const [u] of us) if (!u.isAir && !u.dead && inSolid(G, u)) viol++; }
    for (const [u, tx] of us) if ((u.x - 40.5 * T) * (tx - 40.5 * T) > 0) crossed++;
    R[name] = { violations: viol, crossed: crossed + '/' + us.length }; return G; };
  const grp = (k, team, x0, x1, n) => Array.from({ length: n }, (_, i) => [k, team, x0, 36 + i * 1.2, x1, 36 + i * 1.2]);
  run('tanksLongRangeL2R', grp('tank', 0, 25, 55, 6), 40, true);
  run('infantryShortL2R', grp('infantry', 0, 38.5, 42.5, 8), 25, true);
  run('enemyTanksR2L', grp('tank', 1, 56, 24, 6), 40);
  run('enemyInfantryAtGate', [['infantry', 1, 43, 40.5, 37, 40.5], ['infantry', 1, 43, 40, 37, 40], ['tank', 1, 44, 40.5, 36, 40.5]], 20);
  run('enemyLongWall', grp('infantry', 1, 46, 30, 6).map(s => (s[3] = s[5] = 32 + (s[3] - 36), s)), 40);
  run('crowdPush', [...grp('tank', 0, 30, 52, 6), ...grp('infantry', 0, 31, 52, 6), ...grp('harvester', 0, 29, 52, 3)], 30, true);
  const G = mk(); const ownThroughGate = G.spawnUnit('tank', 0, 37 * T, 40.5 * T); ownThroughGate.command({ type: 'move', x: 45 * T, y: 40.5 * T }); for (let i = 0; i < 20 * 30; i++) G.update(1 / 30);
  R.friendlyGateOpens = ownThroughGate.x > 42 * T;
  const A = mk(); const jet = A.spawnUnit('jet', 0, 30 * T, 40 * T), car = A.spawnUnit('carrier', 0, 30 * T, 42 * T); jet.command({ type: 'move', x: 52 * T, y: 40 * T }); car.command({ type: 'move', x: 52 * T, y: 42 * T });
  let maxDev = 0; for (let i = 0; i < 25 * 30; i++) { A.update(1 / 30); if (car.x < 51 * T) maxDev = Math.max(maxDev, Math.abs(car.y - 42 * T)); }
  R.aircraftFlyOver = jet.x > 48 * T && car.x > 48 * T && maxDev < 8; return R; }
"""
with sync_playwright() as p:
    out = {}
    for bn in ['chromium', 'firefox', 'webkit']:
        for vn, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})), ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, **({} if bn == 'firefox' else {'is_mobile': True})))]:
            br = getattr(p, bn).launch(); pg = br.new_context(**opt).new_page(); E = []
            pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.on('console', lambda m: E.append(m.text[:200]) if m.type == 'error' else None)
            pg.goto(URL); pg.wait_for_timeout(1500)
            b = pg.locator('#startBtn'); (b.tap() if vn == 'phone' else b.click()); pg.wait_for_timeout(1500)
            R = pg.evaluate(SIM); R['playing'] = pg.evaluate("() => document.getElementById('startMenu').hidden && game.time > 0.5")
            if SHOT:
                pg.evaluate("""() => { const g = game, T = 32; g.fog.enabled = false; for (let y = 14; y <= 22; y++) g.addBuilding(y === 18 ? 'gate' : 'wall', 1, 18, y).age = 9;
                  for (let i = 0; i < 5; i++) g.spawnUnit(i % 2 ? 'tank' : 'infantry', 0, 14 * T, (15 + i * 1.4) * T).command({ type: 'move', x: 24 * T, y: (15 + i * 1.4) * T }); camera.centerOn(18 * T, 18 * T); }""")
                pg.wait_for_timeout(3500); pg.screenshot(path=f'{SHOT}/walls-{bn}-{vn}.png')
            R['errors'] = E; out[f'{bn}-{vn}'] = R; br.close()
    print(json.dumps(out, indent=1))
