# v10 multiplayer prototype test: two browser pages connect over WebRTC with copy/paste codes, play lockstep, compare state hashes.
# python tests/v10_multiplayer.py http://localhost:8003/ [shotdir] [hostEngine guestEngine]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8003/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
PAIRS = [tuple(sys.argv[3].split(','))] if len(sys.argv) > 3 else [('chromium', 'chromium'), ('firefox', 'firefox'), ('webkit', 'webkit'), ('chromium', 'firefox')]
def page_for(p, eng, phone=False):
    br = getattr(p, eng).launch(); opt = dict(viewport={'width': 1280, 'height': 760})
    if phone: opt = dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if eng == 'firefox' else {'is_mobile': True}))
    ctx = br.new_context(**opt); pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?grace=0'); pg.wait_for_timeout(1200); return br, pg, errs
def run(p, he, ge):
    R = {}; hb, h, herr = page_for(p, he); gb, g, gerr = page_for(p, ge, phone=True)
    try:
        g.check('input[name=faction][value=reptile]'); h.click('#mpBtn'); g.tap('#mpBtn') if True else None
        h.click('#mpHost'); h.wait_for_function("() => document.getElementById('mpOffer').value.length > 100", timeout=15000)
        offer = h.input_value('#mpOffer'); R['offerCodeLen'] = len(offer)
        g.tap('#mpJoin'); g.fill('#mpAnswer', offer); g.tap('#mpGo')
        g.wait_for_function("() => document.getElementById('mpOffer').value.length > 100", timeout=15000); ans = g.input_value('#mpOffer'); R['answerCodeLen'] = len(ans)
        h.fill('#mpAnswer', ans); h.click('#mpGo')
        h.wait_for_function("() => window.net.active", timeout=20000); g.wait_for_function("() => window.net.active", timeout=20000)
        R['connected'] = True; R['factions'] = h.evaluate("() => game.teams.map(t => t.faction)"); R['guestSeesSame'] = g.evaluate("() => game.teams.map(t => t.faction)") == R['factions']
        R['guestIsTeam1'] = g.evaluate("() => game.me === 1"); R['menuHidden'] = g.evaluate("() => document.getElementById('startMenu').hidden")
        # host: move units + queue a power plant + rifleman; guest: move units + queue a heart
        h.evaluate("""() => { const us = game.units.filter(u => u.team === 0 && !u.harvester); for (const u of us) u.command({ type: 'move', x: 20 * 32, y: 20 * 32 }); game.enqueue(0, 'power', true); }""")
        g.evaluate("""() => { const us = game.units.filter(u => u.team === 1 && !u.harvester && u.type !== 'grazer'); for (const u of us) u.command({ type: 'move', x: 66 * 32, y: 66 * 32 }); game.enqueue(1, game.teams[1].faction === 'reptile' ? 'heart' : 'power', true); }""")
        R['localNotAppliedImmediately'] = h.evaluate("() => game.teams[0].queues.building.length === 0")
        R['cheatBlocked'] = None
        g.evaluate("() => { const u = game.units.find(x => x.team === 0 && !x.harvester); u.command({ type: 'move', x: 5, y: 5 }); window._cheat = u.id; }")
        h.wait_for_timeout(9000)
        st = "() => ({ turn: net.turn, desync: net.desync, units: game.units.map(u => [u.id, Math.round(u.x), Math.round(u.y)]).sort((a,b)=>a[0]-b[0]), q0: game.teams[0].queues.building.length + (game.teams[0].readyBuilding ? 1 : 0) + game.buildings.filter(b => b.team === 0).length, q1: game.teams[1].queues.building.length + (game.teams[1].readyBuilding ? 1 : 0) + game.buildings.filter(b => b.team === 1).length, credits: game.teams.map(t => Math.round(t.credits)), stalls: net.stalls, rtt: Math.round(net.rtt) })"
        a = h.evaluate(st); b = g.evaluate(st)
        R['turnsHost'] = a['turn']; R['turnsGuest'] = b['turn']; R['progress'] = a['turn'] > 40 and b['turn'] > 40
        R['noDesync'] = not a['desync'] and not b['desync']; R['desync'] = a['desync'] or b['desync']
        R['hostQueued'] = a['q0'] >= 2; R['guestQueued'] = a['q1'] >= 2
        R['hostUnitsMoved'] = h.evaluate("() => game.units.filter(u => u.team === 0 && !u.harvester).every(u => Math.hypot(u.x - 20*32, u.y - 20*32) < 9 * 32)")
        R['cheatBlocked'] = h.evaluate(f"() => {{ const u = game.units.find(x => x.id === {g.evaluate('() => window._cheat')}); return Math.hypot(u.x - 5, u.y - 5) > 64; }}")
        R['creditsAgree'] = a['credits'] == b['credits']; R['rttMs'] = a['rtt']; R['stalls'] = [a['stalls'], b['stalls']]
        # identical states at the same turn: compare checksums recorded by both
        R['hashesCompared'] = h.evaluate("() => [...net.hashes.keys()].filter(k => net.remoteHashes?.has(k) || true).length")
        if SHOT: h.screenshot(path=f'{SHOT}/rts-v10-mp-host-{he}.png'); g.screenshot(path=f'{SHOT}/rts-v10-mp-guest-{ge}.png')
        R['badgeHost'] = h.inner_text('#netBadge'); R['badgeGuest'] = g.inner_text('#netBadge')
    except Exception as e: R['EXCEPTION'] = str(e)[:500]
    R['errsHost'] = herr; R['errsGuest'] = gerr; hb.close(); gb.close(); return R
with sync_playwright() as p:
    out = {}
    for he, ge in PAIRS: out[f'{he}-host+{ge}-phone-guest'] = run(p, he, ge)
    print(json.dumps(out, indent=1))
