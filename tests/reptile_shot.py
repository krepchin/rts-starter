# python tests/reptile_shot.py URL out.png  -> reptile base + army close-up
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    pg = p.chromium.launch().new_page(viewport={'width': 1280, 'height': 800}); E = []
    pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    pg.goto(URL + '?grace=0&faction=reptile&autostart=1'); pg.wait_for_timeout(2500)
    pg.evaluate("""() => { const T = 32; for (const b of game.buildings) if (b.team === 0 && b.progress !== undefined) b.progress = 1;
      const keys = Object.keys(BUILDINGS_ALL()).filter(k => BUILDINGS_ALL()[k].faction === 'reptile' && BUILDINGS_ALL()[k].buildable !== false && k !== game.buildings[0].type);
      let x = 13, y = 5; for (const k of keys) { const s = BUILDINGS_ALL()[k]; if (y + s.h > 20) { y = 5; x += 4; } const b = game.addBuilding(k, 0, x, y); b.age = 9; if ('progress' in b) b.progress = 1; y += s.h + 1; }
      ['raider','spitter','brute','shaman','spark','lance','hiveorb','grazer','broodship'].forEach((k, i) => game.spawnUnit(k, 0, (5 + (i % 5) * 2) * T, (14 + Math.floor(i / 5) * 3) * T));
      camera.centerOn(13 * T, 12 * T); }""".replace('BUILDINGS_ALL()', 'window.__B'))
    pg.wait_for_timeout(1500); pg.screenshot(path=OUT); print(E)
