# audio: unlock on first tap, music schedules (no square oscillators in the score), new SFX fire without errors, mute + music toggle
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
with sync_playwright() as p:
    out = {}
    for eng in ['chromium', 'firefox', 'webkit']:
        br = getattr(p, eng).launch(args=['--autoplay-policy=no-user-gesture-required'] if eng == 'chromium' else []); pg = br.new_page(); E = []
        pg.on('console', lambda m: E.append(m.text[:150]) if m.type == 'error' else None); pg.on('pageerror', lambda e: E.append(str(e)[:150]))
        pg.add_init_script("""(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; window.__osc = {};
          const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { const n = o.call(this); const st = n.start.bind(n); n.start = (...a) => { window.__osc[n.type] = (window.__osc[n.type] || 0) + 1; return st(...a); }; return n; }; })()""")
        pg.goto(URL + '?grace=0&faction=human'); pg.wait_for_timeout(1200)
        pg.locator('#startBtn').click(); pg.wait_for_timeout(1500); pg.mouse.click(300, 300); pg.wait_for_timeout(500)
        r = pg.evaluate("""async () => { const s = sound; window.__osc = {}; const st0 = s.stats.played;
          for (const n of ['select', 'move', 'attack', 'click', 'stage', 'powerup', 'mine', 'mg', 'cannon', 'rocket', 'boom_l', 'die_inf', 'constructed']) s.play(n, { stats: { faction: 'human' } });
          for (const f of ['reptile', 'nordic', 'grey']) { s.play('mine', { stats: { faction: f } }); s.play('stage', { stats: { faction: f } }); }
          const b = game.addBuilding('power', 0, 12, 6); b.age = 0; await new Promise(r => setTimeout(r, 6000));
          const oscMusic = { ...window.__osc }; const m0 = s.musicOn; s.toggleMusic(); const m1 = s.musicOn; s.toggleMusic();
          return { state: s.ctx && s.ctx.state, played: s.stats.played - st0, samples: s.stats.samples, osc: oscMusic, musicToggle: [m0, m1, s.musicOn], musBtn: !!document.getElementById('musBtn') }; }""")
        r['errors'] = E; out[eng] = r; br.close()
    print(json.dumps(out, indent=1))
