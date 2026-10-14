# python tests/reptile_show.py URL out.png [phone] -> every reptilian unit + building in one daylight scene
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2]; phone = len(sys.argv) > 3
with sync_playwright() as p:
    br = p.chromium.launch(); E = []
    opt = dict(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2) if phone else dict(viewport={'width': 1280, 'height': 800})
    pg = br.new_context(**opt).new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.on('console', lambda m: m.type == 'error' and E.append(m.text[:200]))
    pg.goto(URL + '?grace=0&faction=reptile&autostart=1'); pg.wait_for_timeout(3000)
    pg.evaluate("""() => { const T = 32, U = ['raider','spitter','brute','shaman','grazer','biotank','spark','lance','hiveorb','broodship','hatchling'];
      U.forEach((k, i) => { try { const u = game.spawnUnit(k, 0, (12 + (i % 4) * 2.6) * T, (11 + Math.floor(i / 4) * 2.6) * T); } catch (e) {} });
      const B = Object.keys(window.__B).filter(k => window.__B[k].faction === 'reptile' && window.__B[k].buildable !== false);
      let x = 3, y = 18; for (const k of B) { try { const b = game.addBuilding(k, 0, x, y); b.age = 9; if ('progress' in b) b.progress = 1; x += window.__B[k].w + 1; if (x > 22) { x = 3; y += 4; } } catch (e) {} }
      camera.centerOn(14 * T, 15 * T); }""")
    pg.wait_for_timeout(1500); pg.screenshot(path=OUT); print('errors', E); br.close()
