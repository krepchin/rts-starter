# python tests/grey_air_shot.py http://localhost:8795/ /workspace/renders
import sys, json
from playwright.sync_api import sync_playwright
URL, SHOT = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1280, 'height': 800}); E = []
    pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    pg.goto(URL + '?grace=0'); pg.wait_for_timeout(1200)
    pg.locator('#factionPick .fac[data-fac=grey]').click(); pg.locator('#startBtn').click(); pg.wait_for_timeout(1500)
    r = pg.evaluate("""async () => { const T = 32, cx = 30 * T, cy = 30 * T;
      const m = game.spawnUnit('mothership', 0, cx, cy); const s1 = game.spawnUnit('scoutsaucer', 0, cx - 140, cy + 60), s2 = game.spawnUnit('warsaucer', 0, cx + 150, cy + 50), s3 = game.spawnUnit('saucer', 0, cx - 40, cy + 130);
      for (let i = 0; i < 4; i++) game.spawnUnit('probe', 0, cx + 60 + i * 18, cy - 80 + i * 10);
      camera.centerOn(cx, cy + 30); await new Promise(r => setTimeout(r, 800)); return { docked: m.docked }; }""")
    pg.screenshot(path=f'{SHOT}/grey-air-docked.png')
    r2 = pg.evaluate("""async () => { const T = 32, cx = 30 * T, cy = 30 * T; for (let i = 0; i < 5; i++) game.spawnUnit('tank', 1, cx + 120 + i * 20, cy + 200);
      const inf = game.spawnUnit('infantry', 1, cx - 40, cy + 140);
      await new Promise(r => setTimeout(r, 5000)); const m = game.units.find(u => u.type === 'mothership');
      return { docked: m.docked, minis: game.units.filter(u => u.type === 'minisaucer').length, orbs: game.units.filter(u => u.type === 'orbling').length }; }""")
    pg.screenshot(path=f'{SHOT}/grey-air-combat.png')
    r3 = pg.evaluate("""async () => { for (const u of game.units) if (u.team === 1 && u.kind === 'unit') u.damage(99999); await new Promise(r => setTimeout(r, 9000));
      const m = game.units.find(u => u.type === 'mothership'); return { docked: m.docked, minis: game.units.filter(u => u.type === 'minisaucer').length, orbs: game.units.filter(u => u.type === 'orbling').length }; }""")
    print(json.dumps({'start': r, 'combat': r2, 'recalled': r3, 'errors': E}))
