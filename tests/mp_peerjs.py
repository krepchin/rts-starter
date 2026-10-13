# Two browser contexts: host creates a PeerJS room, guest joins by code, each with its own faction; verify both start, commands sync both ways, hashes match, disconnect -> AI takeover.
# python tests/mp_peerjs.py http://localhost:8795/ [shotdir] [hostEng,guestEng]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; SHOT = sys.argv[2] if len(sys.argv) > 2 else None
PAIRS = [tuple(sys.argv[3].split(','))] if len(sys.argv) > 3 else [('chromium', 'firefox'), ('chromium', 'webkit'), ('firefox', 'chromium')]
def page(p, eng, phone, fac):
    br = getattr(p, eng).launch(); opt = dict(viewport={'width': 1280, 'height': 760})
    if phone: opt = dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if eng == 'firefox' else {'is_mobile': True}))
    pg = br.new_context(**opt).new_page(); E = []
    pg.on('console', lambda m: E.append(m.text[:200]) if m.type == 'error' else None); pg.on('pageerror', lambda e: E.append(str(e)[:200]))
    pg.goto(URL + f'?grace=0&faction={fac}'); pg.wait_for_timeout(1500)
    pg.locator(f'#factionPick .fac[data-fac={fac}]').click(); pg.locator('#mpBtn').click(); return br, pg, E
def run(p, he, ge):
    hb, h, HE = page(p, he, False, 'grey'); gb, g, GE = page(p, ge, True, 'nordic'); R = {}
    h.locator('#mpHost').click(); h.wait_for_function("() => document.getElementById('mpCode').textContent.length === 5", timeout=20000)
    code = h.evaluate("() => document.getElementById('mpCode').textContent"); R['code'] = code
    if SHOT: h.screenshot(path=f'{SHOT}/mp-lobby-{he}.png')
    g.fill('#mpJoinCode', code); g.locator('#mpJoin').click()
    for pg in (h, g): pg.wait_for_function("() => net.active && document.getElementById('startMenu').hidden", timeout=30000)
    R['factions'] = [h.evaluate("() => [game.teams[0].faction, game.teams[1].faction]"), g.evaluate("() => [game.teams[0].faction, game.teams[1].faction]")]
    h.wait_for_timeout(1500)
    # host orders its first unit to move; guest orders its first unit to move
    h.evaluate("() => { const u = game.units.find(u => u.team === 0 && u.type !== 'reaper'); window.__mv = u.id; u.command({ type: 'move', x: 20*32, y: 20*32 }); }")
    g.evaluate("() => { const u = game.units.find(u => u.team === 1 && u.type !== 'harmonizer'); window.__mv = u.id; u.command({ type: 'move', x: 70*32, y: 70*32 }); }")
    h.wait_for_timeout(15000)
    hid, gid = h.evaluate("() => window.__mv"), g.evaluate("() => window.__mv")
    pos = "id => { const u = game.units.find(u => u.id === id); return u ? [Math.round(u.x), Math.round(u.y)] : null; }"
    R['hostUnitOnHost'], R['hostUnitOnGuest'] = h.evaluate(pos, hid), g.evaluate(pos, hid)
    R['guestUnitOnGuest'], R['guestUnitOnHost'] = g.evaluate(pos, gid), h.evaluate(pos, gid)
    R['turns'] = [h.evaluate("() => net.turn"), g.evaluate("() => net.turn")]
    R['desync'] = [h.evaluate("() => net.desync"), g.evaluate("() => net.desync")]
    R['syncBothWays'] = R['hostUnitOnHost'] == R['hostUnitOnGuest'] and R['guestUnitOnGuest'] == R['guestUnitOnHost'] and R['hostUnitOnHost'] is not None
    if SHOT: h.screenshot(path=f'{SHOT}/mp-host-{he}.png'); g.screenshot(path=f'{SHOT}/mp-guest-{ge}.png')
    gb.close(); h.wait_for_timeout(9000)
    R['afterDisconnect'] = h.evaluate("() => ({ active: net.active, takeover: !!window.__aiTakeover, badge: window.netBadge?.textContent, t0: game.time })"); h.wait_for_timeout(1500)
    R['stillRunning'] = h.evaluate("() => game.time") > R['afterDisconnect']['t0']
    R['errors'] = {'host': HE, 'guest': GE}; hb.close(); return R
with sync_playwright() as p:
    out = {}
    for he, ge in PAIRS:
        try: out[f'{he}-host+{ge}-guest'] = run(p, he, ge)
        except Exception as e: out[f'{he}-host+{ge}-guest'] = {'exception': str(e)[:300]}
    print(json.dumps(out, indent=1))
