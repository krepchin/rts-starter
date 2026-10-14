# frames of the reptilian organic building rise + living brood ship. python tests/rise_frames.py URL outdir
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    pg = p.chromium.launch().new_page(viewport={'width': 900, 'height': 600}); E = []; pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    pg.goto(URL + '?grace=0&faction=reptile&autostart=1'); pg.wait_for_timeout(2500)
    pg.evaluate("""() => { const T = 32; window.__rb = game.addBuilding('dronenest', 0, 12, 9); window.__rb.age = 0; game.addBuilding('broodspire', 0, 16, 9).age = 0;
      const s = game.spawnUnit('broodship', 0, 15 * T, 16 * T); s.command({ type: 'move', x: 22 * T, y: 13 * T }); game.spawnUnit('lance', 0, 11 * T, 16 * T).command({ type: 'move', x: 6 * T, y: 18 * T }); camera.centerOn(15 * T, 12 * T); }""")
    for i, ms in enumerate([150, 500, 600, 600, 700, 900]):
        pg.wait_for_timeout(ms); pg.screenshot(path=f'{OUT}/rise-{i}.png')
    print(E)
