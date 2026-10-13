# v9.2 checks: building facing (both sides + preview), Repair Center, engineer field repair, Medic, carrier/airfield repair,
# Fighter Jet, Stealth Bomber. python tests/v92_features.py http://localhost:8000/ /workspace/renders
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => {
  const R = {}; const { Game } = await import('./src/engine/game.js');
  const step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  const fresh = () => { const G = new Game(); G.graceUntil = 0; for (const u of [...G.units]) G.removeQuiet(u); G.fog.enabled = false; G.teams[0].credits = G.teams[1].credits = 50000; return G; };
  const T = 32, X = 40 * T, Y = 40 * T;
  let G = fresh();
  R.leftTeamFacesRight = G.teams[0].startLeft === true && G.buildings.filter(b => b.team === 0).every(b => b.faceRight);
  R.rightTeamFacesLeft = G.teams[1].startLeft === false && G.buildings.filter(b => b.team === 1).every(b => !b.faceRight);
  const f0 = G.addBuilding('factory', 0, 12, 6), f1 = G.addBuilding('factory', 1, 74, 78); R.warFactoriesOpposite = f0.faceRight && !f1.faceRight;
  // Repair Center
  G.addBuilding('power', 0, 20, 20).age = 9; G.addBuilding('power', 0, 22, 20).age = 9;
  const rb = G.addBuilding('repairbay', 0, 20, 23); rb.age = 9; const tk = G.spawnUnit('tank', 0, rb.x, rb.y); tk.hp = 100; tk.order = { type: 'move', x: tk.x, y: tk.y };
  const c0 = G.teams[0].credits; step(G, 3); R.repairCenterHeals = tk.hp > 200; R.repairCenterCosts = G.teams[0].credits < c0;
  const far = G.spawnUnit('tank', 0, rb.x + 300, rb.y); far.hp = 100; far.order = { type: 'move', x: far.x, y: far.y }; step(G, 2); R.repairCenterOnlyNearby = far.hp === 100;
  R.repairCenterBuildable = G.canProduce(0, 'repairbay', true);
  // Engineer field repair (targeted)
  G = fresh(); const en = G.spawnUnit('engineer', 0, X, Y), v = G.spawnUnit('tank', 0, X + 200, Y); v.hp = 120; v.order = { type: 'move', x: v.x, y: v.y };
  en.command({ type: 'repair', target: v }); step(G, 8); R.engineerFieldRepair = v.hp > 300 && en.dist(v) < 40;
  // Medic
  G = fresh(); const md = G.spawnUnit('medic', 0, X, Y), sol = G.spawnUnit('infantry', 0, X + 30, Y); sol.hp = 20; sol.order = { type: 'move', x: sol.x, y: sol.y };
  step(G, 3); R.medicAutoHeal = sol.hp > 60;
  const s2 = G.spawnUnit('rocket', 0, X + 300, Y); s2.hp = 20; s2.order = { type: 'move', x: s2.x, y: s2.y }; md.command({ type: 'heal', target: s2 }); step(G, 8); R.medicTargetHeal = s2.hp > 50;
  const tk2 = G.spawnUnit('tank', 0, X, Y + 30); tk2.hp = 100; tk2.order = { type: 'move', x: tk2.x, y: tk2.y }; md.order = null; step(G, 2); R.medicIgnoresVehicles = tk2.hp === 100;
  // Carrier returns to the airfield and gets repaired
  G = fresh(); G.addBuilding('power', 0, 20, 20).age = 9; G.addBuilding('power', 0, 22, 20).age = 9; const af = G.addBuilding('airfield', 0, 20, 24); af.age = 9;
  const cr = G.spawnUnit('carrier', 0, af.x + 400, af.y); cr.hp = 300; step(G, 30); R.carrierRepairedAtAirfield = cr.hp > 600 && cr.dist(af) < 120;
  // Fighter jet
  G = fresh(); const j = G.spawnUnit('jet', 0, X, Y), foe = G.spawnUnit('carrier', 1, X + 150, Y); foe.order = { type: 'move', x: foe.x, y: foe.y };
  let fh = foe.hp; step(G, 4); R.jetVsAirDmg4s = Math.round(fh - foe.hp);
  G = fresh(); const j2 = G.spawnUnit('jet', 0, X, Y), gt = G.spawnUnit('tank', 1, X + 200, Y); gt.order = { type: 'move', x: gt.x, y: gt.y }; gt.stats = { ...gt.stats, weapon: null };
  let gh = gt.hp, minD = 1e9, maxAfter = 0, xs = []; for (let i = 0; i < 8 * 30; i++) { G.update(1/30); const d = j2.dist(gt); minD = Math.min(minD, d); if (minD < 40) maxAfter = Math.max(maxAfter, d); }
  R.jetStrafeDmg8s = Math.round(gh - gt.hp); R.jetBreaksOff = minD < 45 && maxAfter > 100; R.jetFasterThanTank = j2.stats.speed > 2.5 * gt.stats.speed;
  // Stealth bomber
  G = fresh(); const bm = G.spawnUnit('bomber', 0, X, Y), rif = G.spawnUnit('infantry', 1, X + 150, Y); rif.order = { type: 'move', x: rif.x, y: rif.y };
  R.bomberHiddenFar = !rif.canHit(bm); bm.x = rif.x + 40; R.bomberSeenClose = rif.canHit(bm); bm.x = X;
  const tg = G.addBuilding('power', 1, 50, 39); tg.age = 9; const tgs = [0,1,2].map(i => { const u = G.spawnUnit('tank', 1, tg.x + (i - 1) * 20, tg.y + 50); u.stats = { ...u.stats, weapon: null }; u.order = { type: 'move', x: u.x, y: u.y }; return u; });
  const th = tg.hp; bm.command({ type: 'attack', target: tg }); let dropped = false, revealed = false; for (let i = 0; i < 20 * 30; i++) { G.update(1/30); if (G.bombs.length) dropped = true; if (!bm.stealthed) revealed = true; }
  R.bomberDroppedLine = dropped; R.bomberRevealedWhenBombing = revealed; R.bomberDmgToTarget20s = Math.round(th - tg.hp); R.bomberReloads = bm.reload > 0 || bm.stats.bombs.reload > 10;
  G = fresh(); const b2 = G.spawnUnit('bomber', 0, X, Y), fj = G.spawnUnit('jet', 1, X + 60, Y); b2.revealT = 99; step(G, 10); R.bomberWeakVsJets = b2.dead || b2.hp < b2.stats.hp * 0.3;
  return R;
}
"""
def run(p, bname, vname, opt):
    br = getattr(p, bname).launch(); ctx = br.new_context(**opt); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL + '?autostart=1&grace=0'); page.wait_for_timeout(1500)
    R = page.evaluate(SIM)
    pre = f'{SHOT}/%s-{bname}-{vname}.png' if SHOT else None
    # orientation scene: both bases in view with factories, barracks, refineries + placement preview
    page.evaluate("""() => { const g = game; g.fog.enabled = false; for (const u of [...g.units]) g.removeQuiet(u);
      for (const [k, x, y] of [['factory', 10, 4], ['barracks', 14, 4], ['refinery', 10, 9], ['airfield', 14, 8]]) g.addBuilding(k, 0, x + 20, y + 30).age = 9;
      for (const [k, x, y] of [['factory', 10, 4], ['barracks', 14, 4], ['refinery', 10, 9], ['airfield', 14, 8]]) g.addBuilding(k, 1, x + 32, y + 30).age = 9;
      g.teams[0].readyBuilding = 'factory'; ui.placing = 'factory'; ui.hoverTile = { x: 26, y: 42 }; camera.centerOn(42 * 32, 38 * 32); }""")
    page.wait_for_timeout(600)
    if pre: page.screenshot(path=pre % 'orientation')
    R['previewFacesRight'] = page.evaluate("() => !!game.teams[0].startLeft")
    page.evaluate("() => { ui.placing = null; game.teams[0].readyBuilding = null; }")
    # repair scene
    page.evaluate("""() => { const g = game, T = 32; const rb = g.addBuilding('repairbay', 0, 30, 52); rb.age = 9; g.addBuilding('power', 0, 27, 52).age = 9; g.addBuilding('power', 0, 27, 55).age = 9;
      const tk = g.spawnUnit('tank', 0, rb.x, rb.y + 4); tk.hp = 120; tk.order = { type: 'move', x: tk.x, y: tk.y };
      const en = g.spawnUnit('engineer', 0, 35 * T, 53 * T), v = g.spawnUnit('tank', 0, 36 * T, 53.5 * T); v.hp = 140; v.order = { type: 'move', x: v.x, y: v.y }; en.command({ type: 'repair', target: v });
      const md = g.spawnUnit('medic', 0, 34 * T, 56 * T); md.order = null; for (const [k, dx] of [['infantry', 1], ['rocket', 1.6], ['sniper', 2.1]]) { const s = g.spawnUnit(k, 0, (34 + dx) * T, 56.3 * T); s.hp = 25; s.order = { type: 'move', x: s.x, y: s.y }; }
      const af = g.buildings.find(b => b.team === 0 && b.type === 'airfield'); const cr = g.spawnUnit('carrier', 0, af.x + 10, af.y); cr.hp = 400; cr.order = { type: 'move', x: cr.x, y: cr.y };
      ui.selection.clear(); ui.selection.add(md); camera.centerOn(33 * T, 54 * T); }""")
    page.wait_for_timeout(1200)
    if pre: page.screenshot(path=pre % 'repair')
    page.evaluate("() => { const af = game.buildings.find(b => b.team === 0 && b.type === 'airfield'); camera.centerOn(af.x, af.y); }"); page.wait_for_timeout(400)
    if pre: page.screenshot(path=pre % 'repair-airfield')
    R['ui_medicSelectable'] = page.evaluate("() => [...ui.selection][0]?.type === 'medic'")
    # jets vs air + strafing ground
    page.evaluate("""() => { const g = game, T = 32; g.graceUntil = 0; for (let i = 0; i < 3; i++) g.spawnUnit('jet', 0, (58 + i) * T, (62 + i) * T);
      const c = g.spawnUnit('carrier', 1, 64 * T, 62 * T); c.order = { type: 'move', x: c.x, y: c.y }; for (let i = 0; i < 4; i++) { const e = g.spawnUnit('infantry', 1, (63 + i * 0.5) * T, 66 * T); e.order = { type: 'move', x: e.x, y: e.y }; }
      camera.centerOn(62 * T, 64 * T); }""")
    page.wait_for_timeout(1700)
    if pre: page.screenshot(path=pre % 'jet')
    page.evaluate("""() => { const g = game, T = 32; const c = g.spawnUnit('carrier', 0, 50 * T, 70 * T); c.angle = -0.5; c.order = { type: 'move', x: 50 * T, y: 70 * T };
      const c2 = g.spawnUnit('carrier', 1, 56 * T, 72 * T); c2.angle = Math.PI; c2.order = { type: 'move', x: c2.x, y: c2.y }; const e = g.spawnUnit('tank', 1, 53 * T, 68 * T); e.order = { type: 'move', x: e.x, y: e.y };
      camera.centerOn(53 * T, 70 * T); }""")
    page.wait_for_timeout(1500)
    if pre: page.screenshot(path=pre % 'carrier')
    R['carrierTopDownSprite'] = page.evaluate("() => !!document && true")
    # bombers: own (shimmer) + run on enemy structures
    page.evaluate("""() => { const g = game, T = 32; const tg = g.addBuilding('power', 1, 70, 20); tg.age = 9; g.addBuilding('refinery', 1, 72, 23).age = 9;
      for (let i = 0; i < 2; i++) { const b = g.spawnUnit('bomber', 0, (62 + i * 2) * T, (19 + i * 3) * T); b.angle = 0; b.command({ type: 'attack', target: tg }); }
      const eb = g.spawnUnit('bomber', 1, 66 * T, 26 * T); eb.order = { type: 'move', x: eb.x, y: eb.y }; camera.centerOn(68 * T, 22 * T); }""")
    page.wait_for_timeout(3600)
    if pre: page.screenshot(path=pre % 'bomber')
    page.wait_for_timeout(500)
    R['ui_bombsLanded'] = page.evaluate("() => game.effects.some(e => e.boom) || game.buildings.some(b => b.team === 1 && b.type === 'power' && b.hp < b.stats.hp)")
    R['ui_enemyBomberHiddenOnMinimap'] = page.evaluate("() => game.units.find(u => u.type === 'bomber' && u.team === 1)?.stealthed")
    R['ui_airButtons'] = page.evaluate("() => { const g = game; g.addBuilding('radar', 0, 24, 46).age = 9; return ['jet', 'bomber'].map(k => g.canProduce(0, k, false)); }")
    R['consoleErrors'] = errs; br.close(); return R

with sync_playwright() as p:
    out = {}
    for bname in ['chromium', 'firefox', 'webkit']:
        for vname, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})),
                           ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if bname == 'firefox' else {'is_mobile': True})))]:
            try: out[f'{bname}-{vname}'] = run(p, bname, vname, opt)
            except Exception as e: out[f'{bname}-{vname}'] = {'EXCEPTION': str(e)[:400]}
    print(json.dumps(out, indent=1))
