# frames of staged construction for each faction. python tests/build_frames.py URL outdir
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]
B = {'human': ['factory', 'barracks'], 'nordic': ['temple', 'forge'], 'grey': ['vat', 'assembly'], 'reptile': ['dronenest', 'spawnpool']}
with sync_playwright() as p:
    pg = p.chromium.launch().new_page(viewport={'width': 900, 'height': 600}); E = []; pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    for fk, bs in B.items():
        pg.goto(URL + f'?grace=0&faction={fk}&autostart=1'); pg.wait_for_timeout(2500)
        pg.evaluate("(bs) => { const T = 32; bs.forEach((k, i) => { const b = game.addBuilding(k, 0, 12 + i * 5, 9); b.age = 0; }); camera.centerOn(15 * T, 11 * T); }", bs)
        for i in range(6): pg.wait_for_timeout(450); pg.screenshot(path=f'{OUT}/build-{fk}-{i}.png', clip={'x': 200, 'y': 150, 'width': 460, 'height': 260})
    print(E)
