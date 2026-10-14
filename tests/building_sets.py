# python tests/building_sets.py URL outdir tag -> one image per faction with its full building set (incl. walls + gate), plus a 2x2 side-by-side sheet
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
URL, OUT, TAG = sys.argv[1], sys.argv[2], sys.argv[3]; E = []; files = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for fk in ['human', 'reptile', 'nordic', 'grey']:
        pg = br.new_context(viewport={'width': 1280, 'height': 800}).new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.on('console', lambda m: m.type == 'error' and E.append(m.text[:200]))
        pg.goto(URL + f'?grace=0&faction={fk}&autostart=1'); pg.wait_for_timeout(2500)
        pg.evaluate("""(fk) => { const T = 32; for (const u of game.units.filter(u => u.team === 0)) u.dead = true;
          for (const b of game.buildings.filter(b => b.team === 0)) { b.dead = true; } game.buildings = game.buildings.filter(b => !b.dead); game.units = game.units.filter(u => !u.dead);
          const B = Object.keys(window.__B).filter(k => (window.__B[k].faction || 'human') === fk && !window.__B[k].wall && !window.__B[k].gate && (window.__B[k].buildable !== false || window.__B[k].yard));
          let x = 4, y = 6; for (const k of B) { const s = window.__B[k]; if (x + s.w > 24) { x = 4; y += 5; } try { const b = game.addBuilding(k, 0, x, y); b.age = 9; if ('progress' in b) b.progress = 1; } catch (e) { console.log('x', k, e.message); } x += s.w + 1; }
          y += 5; for (let i = 0; i < 6; i++) try { game.addBuilding('wall', 0, 5 + i, y).age = 9; } catch (e) {}
          try { game.addBuilding('gate', 0, 11, y).age = 9; } catch (e) {} for (let i = 0; i < 3; i++) try { game.addBuilding('wall', 0, 12 + i, y).age = 9; } catch (e) {}
          try { game.addBuilding('wall', 0, 15, y - 1).age = 9; game.addBuilding('wall', 0, 15, y).age = 9; } catch (e) {}
          game.rebuildSolid && game.rebuildSolid(); for (let yy = 0; yy < 30; yy++) for (let xx = 0; xx < 30; xx++) { try { game.teams[0].explored && (game.teams[0].explored[yy * game.map.w + xx] = 1); } catch (e) {} }
          camera.centerOn(14 * T, 11 * T); }""", fk)
        pg.wait_for_timeout(1200); f = f'{OUT}/buildings-{fk}-{TAG}.png'; pg.screenshot(path=f, clip={'x': 0, 'y': 0, 'width': 860, 'height': 640}); files.append(f); pg.context.close()
    br.close()
ims = [Image.open(f) for f in files]; w, h = ims[0].size; sheet = Image.new('RGB', (w * 2, h * 2))
for i, im in enumerate(ims): sheet.paste(im, ((i % 2) * w, (i // 2) * h))
sheet.save(f'{OUT}/buildings-all-{TAG}.png'); print('errors', E)
