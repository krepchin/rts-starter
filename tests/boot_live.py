import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
out = {}
with sync_playwright() as p:
  for bn in ['chromium','firefox','webkit']:
    for vn, opt in [('desktop', dict(viewport={'width':1366,'height':800})), ('phone', dict(viewport={'width':390,'height':844}, has_touch=True, **({} if bn=='firefox' else {'is_mobile':True}), user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'))]:
      br = getattr(p, bn).launch(); ctx = br.new_context(**opt); pg = ctx.new_page(); E = []
      pg.on('console', lambda m: E.append(m.text) if m.type in ('error','warning') else None); pg.on('pageerror', lambda e: E.append('PAGEERR '+str(e)))
      pg.on('response', lambda r: E.append(f'{r.status} {r.url}') if r.status >= 400 else None)
      pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
      R = {'menuVisible': pg.evaluate("() => !document.getElementById('startMenu')?.hidden"), 'hasGame': pg.evaluate("() => !!window.game")}
      try:
        b = pg.locator('#startBtn'); (b.tap() if vn=='phone' else b.click(), )
      except Exception as e: R['clickErr'] = str(e)[:200]
      pg.wait_for_timeout(2000)
      R['menuHiddenAfter'] = pg.evaluate("() => document.getElementById('startMenu')?.hidden")
      pg.wait_for_timeout(1500); R['time'] = pg.evaluate("() => window.game?.time"); R['playing'] = pg.evaluate("() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return r.width > 100 && game.units.length > 0 && game.time > 1; }")
      R['errs'] = E[:8]; out[f'{bn}-{vn}'] = R; br.close()
print(json.dumps(out, indent=1))
