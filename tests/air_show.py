# python tests/air_show.py URL out.png -> every faction's air units in one daylight scene (rows: human, reptile, nordic, grey)
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    br = p.chromium.launch(); E = []; pg = br.new_page(viewport={'width': 1280, 'height': 800}); pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    pg.goto(URL + '?grace=0&faction=human&autostart=1'); pg.wait_for_timeout(2500)
    pg.evaluate("""() => { const T = 32, R = [['jet','bomber','carrier','dropship'], ['spark','lance','hiveorb','broodship'], ['skiff','lightcraft','lightship'], ['scoutsaucer','saucer','warsaucer','mothership']];
      R.forEach((row, r) => row.forEach((k, i) => { try { const u = game.spawnUnit(k, 0, (8 + i * 4.5) * T, (7 + r * 3.6) * T); u.angle = 0.3; } catch (e) { console.log(k, e.message); } }));
      for (let yy = 0; yy < 40; yy++) for (let xx = 0; xx < 40; xx++) try { game.teams[0].explored[yy * game.map.w + xx] = 1; } catch (e) {}
      camera.centerOn(15 * T, 12 * T); }""")
    pg.wait_for_timeout(1500); pg.screenshot(path=OUT, clip={'x': 0, 'y': 0, 'width': 860, 'height': 640}); print('errors', E); br.close()
