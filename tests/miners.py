# Each faction's miner must gather crystals and deliver credits. python tests/miners.py URL
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ENG = sys.argv[2].split(',') if len(sys.argv) > 2 else ['chromium', 'firefox', 'webkit']
with sync_playwright() as p:
    out = {}
    for eng in ENG:
        br = getattr(p, eng).launch(); R = {}
        for fk in ['human', 'reptile', 'nordic', 'grey']:
            pg = br.new_page(); E = []; pg.on('pageerror', lambda e: E.append(str(e)[:200]))
            pg.goto(URL + f'?grace=0&faction={fk}&autostart=1'); pg.wait_for_timeout(2500)
            R[fk] = pg.evaluate("""async () => { const t = game.teams[0], c0 = t.credits; const hv = game.units.filter(u => u.team === 0 && u.load !== undefined);
              const dock = hv[0]?.stats.dock || 'refinery';
              if (!game.buildings.some(b => b.team === 0 && b.type === dock)) { const b = game.addBuilding(dock, 0, 12, 6); b.age = 9; if ('progress' in b) b.progress = 1; }
              const spent = c0 - t.credits;
              // UI path: player orders the miner somewhere, then taps a crystal field with it selected -> must go back to harvesting
              const m = hv[0]; m.command({ type: 'move', x: m.x + 40, y: m.y }); for (let k = 0; k < 60; k++) game.update(1/30);
              let ft = null; for (let y = 0; y < game.map.h && !ft; y++) for (let x = 0; x < game.map.w; x++) if (game.map.tib[game.map.idx(x, y)] > 5 && Math.hypot(x * 32 - m.x, y * 32 - m.y) < 600) { ft = [x, y]; break; }
              ui.selection.clear(); ui.selection.add(m); ui.commandAt ? ui.commandAt(ft[0] * 32 + 16, ft[1] * 32 + 16) : 0; const uiOrder = m.order?.type; const st = []; for (let i = 0; i < 40; i++) { for (let k = 0; k < 30; k++) game.update(1/30); st.push(hv.map(h => h.state + ':' + Math.round(h.load)).join('|')); }
              return { uiOrder, miners: hv.map(h => h.type), dock, gained: t.credits - c0 + spent, maxLoad: Math.max(0, ...hv.map(h => h.load)), trace: st.filter((_, i) => i % 8 === 0) }; }""")
            R[fk]['errors'] = E; pg.close()
        out[eng] = R; br.close()
    print(json.dumps(out, indent=1))
