# python tests/look_shot.py URL outdir tag -> one battle scene per faction (all four armies + bases near the camera)
import sys
from playwright.sync_api import sync_playwright
URL, OUT, TAG = sys.argv[1], sys.argv[2], sys.argv[3]
SCN = """async () => { const T = 32; game.teams[1].faction;
  const put = (k, tm, x, y) => { try { const b = game.addBuilding(k, tm, x, y); b.age = 9; if ('progress' in b) b.progress = 1; return b; } catch (e) { return null; } };
  const sp = (k, tm, x, y) => { try { return game.spawnUnit(k, tm, x * T, y * T); } catch (e) { return null; } };
  return true; }"""
with sync_playwright() as p:
    for vn, opt in [('desktop', dict(viewport={'width': 1280, 'height': 800})), ('phone', dict(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2))]:
        br = p.chromium.launch(); E = []
        for fk in ['human', 'reptile', 'nordic', 'grey']:
            pg = br.new_context(**opt).new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200]))
            pg.goto(URL + f'?grace=0&faction={fk}&autostart=1'); pg.wait_for_timeout(2500)
            pg.evaluate("""(fk) => { const T = 32; const F = { human: ['infantry','rocket','tank','buggy','truck','jet','carrier'], reptile: ['raider','spitter','brute','shaman','spark','lance','grazer','broodship'],
              nordic: ['sentinel','seer','guardian','tallwhite','skiff','lightcraft','lightship'], grey: ['greydrone','psionic','abductor','hybrid','crawler','probe','scoutsaucer','saucer','mothership'] };
              F[fk].forEach((k, i) => { try { game.spawnUnit(k, 0, (13 + (i % 4) * 2.2) * T, (12 + Math.floor(i / 4) * 2.5) * T); } catch (e) {} });
              const B = Object.keys(window.__B).filter(k => (window.__B[k].faction || 'human') === fk && window.__B[k].buildable !== false && !window.__B[k].wall && !window.__B[k].gate);
              let x = 3, y = 15; for (const k of B.slice(0, 5)) { try { const b = game.addBuilding(k, 0, x, y); b.age = 9; if ('progress' in b) b.progress = 1; x += window.__B[k].w + 1; } catch (e) {} }
              camera.centerOn(12 * T, 13 * T); }""", fk)
            pg.wait_for_timeout(1800); pg.screenshot(path=f'{OUT}/{TAG}-{fk}-{vn}.png'); pg.close()
        print(vn, E); br.close()
