# v8 mobile command centre checks: python tests/v8_mobile_base.py http://localhost:8788/ [shotdir]
# Runs Chromium, Firefox and WebKit at desktop + phone (touch) viewports.
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8788/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
SIM = r"""
async () => {
  const R = {}; const { Game } = await import('./src/engine/game.js'); const { EnemyAI } = await import('./src/ai/enemyAI.js');
  const step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  const mb = (G, team) => G.units.find(u => u.team === team && u.carried);
  // (a) pack alone
  let G = new Game(); G.graceUntil = 0; const cy0 = G.buildings.find(b => b.team === 0 && b.type === 'cy'); cy0.hp = 750;
  G.teams[0].credits = 9999; G.enqueue(0, 'power', true);
  R.packStarts = G.packYard(0, cy0); step(G, 1); R.noProductionWhilePacking = G.teams[0].stalled.building === 'no Construction Yard';
  step(G, 2); let m = mb(G, 0); R.packedIsMcv = m?.type === 'mcv' && !G.has(0, 'cy') && !G.over;
  m.command({ type: 'move', x: 27.5 * 32, y: 27.5 * 32 }); step(G, 25); R.mcvMoved = Math.hypot(m.x - 7.5 * 32, m.y - 8.5 * 32) > 200;
  R.mcvDeployStart = m.startDeploy(26, 26); step(G, 3);
  const cy1 = G.buildings.find(b => b.team === 0 && b.type === 'cy'); R.mcvDeployed = !!cy1 && cy1.tx === 26 && m.dead; R.hpKeptPack = !!cy1 && Math.abs(cy1.hp / cy1.stats.hp - 0.5) < 0.02;
  R.buildRadiusFollows = G.canPlace(0, 'power', 29, 26) && !G.canPlace(0, 'power', 8, 6);
  // (b) transform base
  G = new Game(); G.graceUntil = 0; const cy = G.buildings.find(b => b.team === 0 && b.type === 'cy');
  G.addBuilding('barracks', 0, 3, 7); G.addBuilding('power', 0, 10, 6); G.addBuilding('power', 0, 10, 2); G.addBuilding('factory', 0, 6, 10);
  for (const b of G.buildings) b.age = 9;
  step(G, 0.1); const pm0 = G.teams[0].powerMade;
  R.transformStarts = G.transformBase(0, cy); step(G, 4.2); m = mb(G, 0);
  R.robot = m?.type === 'robot'; R.robotCarries = m?.carried.map(c => c.type).sort().join(',');
  R.carriedPowerOffline = G.teams[0].powerMade === pm0 - 100 - 10; R.oneOfTwoPowerLeft = G.buildings.filter(b => b.type === 'power' && b.team === 0).length === 1;
  R.noBuildWhileRobot = !G.enqueue(0, 'turret', true) && !G.enqueue(0, 'infantry', false);
  for (const u of G.units) if (u.team === 0 && !u.carried) G.removeQuiet(u);
  step(G, 1); const eb = G.addBuilding('turret', 1, Math.round(m.x / 32) + 2, Math.round(m.y / 32) - 1); eb.age = 9;
  const eu = G.spawnUnit('tank', 1, m.x + 60, m.y + 10); eu.order = { type: 'move', x: eu.x, y: eu.y };
  const bh = eb.hp, uh = eu.hp; step(G, 1);
  R.sprayMeltsStructure = Math.round(bh - eb.hp); R.sprayVsUnit = Math.round(uh - eu.hp); R.sprayFastVsBuildings = (bh - eb.hp) > 3 * (uh - eu.hp);
  R.toggleToDrill = m.toggleMode() && m.mode === 'drill'; step(G, 1);
  const tgt = G.buildings.find(b => b.team === 1 && b.type === 'cy'); const th = tgt.hp;
  R.burrowStarts = m.burrow(tgt.x, tgt.y + 10); step(G, 1.3); R.underUntargetable = m.under && !eu.canHit(m);
  const hpU = m.hp; m.damage(500); R.noDamageUnder = m.hp === hpU;
  step(G, 40); R.emerged = m.state === 'ready' && m.dist(tgt) < 60; R.eruptionDamage = Math.round(th - tgt.hp); R.burrowCooldown = m.burrowCd > 0 && !m.canBurrow();
  R.toggleBackToSpray = m.toggleMode() && m.mode === 'spray';
  eu.dead = true; eb.dead = true; m.damage(m.stats.hp * 0.25 / 0.6, null, true);
  m.command({ type: 'move', x: 30 * 32, y: 30 * 32 }); step(G, 120); R.walkedBack = Math.hypot(m.x - 960, m.y - 960) < 10;
  const frac = m.hp / m.stats.hp; R.deployStart = m.startDeploy(29, 29); step(G, 4.2);
  const back = G.buildings.filter(b => b.team === 0 && ['cy', 'barracks', 'factory', 'power'].includes(b.type) && b.tx >= 25);
  R.unfoldedCount = back.length; R.hpProportional = back.every(b => Math.abs(b.hp / b.stats.hp - frac) < 0.02);
  R.productionResumes = G.enqueue(0, 'infantry', false);
  R.deployInvalidRejected = (() => { const H = new Game(); const c = H.buildings[0]; H.packYard(0, c); step(H, 3); const x = mb(H, 0); x.state = 'ready'; return !x.startDeploy(78, 78); })();
  const A = new Game(); A.graceUntil = 0; const ai = new EnemyAI(A, 1); A.teams[1].credits = 5000;
  for (let i = 0; i < 60 * 30; i++) { ai.update(1/30); A.update(1/30); }
  const acy = A.buildings.find(b => b.team === 1 && b.type === 'cy'); const atk = A.spawnUnit('tank', 0, acy.x - 100, acy.y - 100);
  acy.damage(acy.stats.hp * 0.6, atk); let sawMobile = false, redeployed = false;
  for (let i = 0; i < 150 * 30; i++) { ai.update(1/30); A.update(1/30); if (mb(A, 1)) sawMobile = true; if (sawMobile && !mb(A, 1) && A.has(1, 'cy')) { redeployed = true; break; } }
  R.aiTransforms = sawMobile; R.aiRedeploys = redeployed;
  const S = new Game(); S.graceUntil = 0; const ai2 = new EnemyAI(S, 1); for (let i = 0; i < 240 * 30; i++) { ai2.update(1/30); S.update(1/30); }
  R.aiBuildings4min = S.buildings.filter(b => b.team === 1).length;
  return R;
}
"""
def run(p, bname, vname, ctxopt):
    br = getattr(p, bname).launch(**({'firefox_user_prefs': {'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0}} if bname == 'firefox' else {}))
    ctx = br.new_context(**ctxopt); page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL + '?autostart=1&grace=0'); page.wait_for_timeout(1500)
    R = page.evaluate(SIM)
    touch = ctxopt.get('has_touch')
    def scr(x, y): return page.evaluate(f"() => {{ const r = document.getElementById('game').getBoundingClientRect(); return {{ x: r.left + {x} - camera.x, y: r.top + {y} - camera.y }}; }}")
    def tapw(x, y):
        pos = scr(x, y)
        if touch: page.touchscreen.tap(pos['x'], pos['y'])
        else: page.mouse.click(pos['x'], pos['y'])
    def btn(act):
        loc = page.locator(f'#selActions button[data-act="{act}"]'); loc.scroll_into_view_if_needed()
        loc.tap() if touch else loc.click()
    pre = f'{SHOT}/rts-v9-{bname}-{vname}' if SHOT else None
    sel = "[...ui.selection][0]"
    page.evaluate("""() => { const g = game; for (const [k,x,y] of [['barracks',3,7],['power',10,6],['factory',6,10]]) g.addBuilding(k,0,x,y).age = 9;
      g.fog.enabled = false; const cy = g.buildings.find(b=>b.team===0&&b.type==='cy'); cy.age = 9; camera.centerOn(cy.x, cy.y); }""")
    page.wait_for_timeout(300)
    cyp = page.evaluate("() => { const c = game.buildings.find(b=>b.team===0&&b.type==='cy'); return [c.x, c.y]; }")
    tapw(*cyp); page.wait_for_timeout(300)
    R['ui_cySelected'] = page.evaluate(f"() => {sel}?.type === 'cy'")
    btn('transform'); page.wait_for_timeout(2200)
    if pre: page.screenshot(path=f'{pre}-transforming.png')
    page.wait_for_timeout(3200)
    R['ui_robotSelected'] = page.evaluate(f"() => {sel}?.type === 'robot'")
    page.evaluate(f"() => {{ const r = {sel}; r.command({{type:'move', x: r.x + 120, y: r.y + 60}}); camera.centerOn(r.x + 60, r.y); }}")
    page.wait_for_timeout(1500)
    if pre: page.screenshot(path=f'{pre}-walker.png')
    page.evaluate(f"() => {{ const r = {sel}; const b = game.addBuilding('barracks', 1, Math.round(r.x/32)+2, Math.round(r.y/32)-1); b.age = 9; window._eb = b; camera.centerOn(r.x+40, r.y-30); }}")
    page.wait_for_timeout(1500)
    if pre: page.screenshot(path=f'{pre}-spray.png')
    R['ui_sprayDamaged'] = page.evaluate("() => _eb.dead || _eb.hp < _eb.stats.hp")
    btn('weapon'); page.wait_for_timeout(300)
    R['ui_toggledDrill'] = page.evaluate(f"() => {sel}.mode === 'drill'")
    page.wait_for_timeout(400)
    btn('burrow'); page.wait_for_timeout(200)
    R['ui_burrowTargeting'] = page.evaluate("() => !!ui.burrowing")
    rp = page.evaluate(f"() => {{ const r = {sel}; camera.centerOn(r.x, r.y); return [r.x + 90, r.y + 110]; }}")
    tapw(*rp); page.wait_for_timeout(1400)
    if pre: page.screenshot(path=f'{pre}-burrow.png')
    page.wait_for_timeout(3500)
    R['ui_burrowed'] = page.evaluate(f"() => {sel}.burrowCd > 0")
    page.wait_for_timeout(600)
    btn('deploy'); page.wait_for_timeout(200)
    R['ui_deployPreview'] = page.evaluate("() => !!ui.deploying")
    dp = page.evaluate(f"""() => {{ const r = {sel}; camera.centerOn(r.x, r.y - 40); const bx = Math.round(r.x/32-1.5), by = Math.round(r.y/32-1.5);
      for (let d = 0; d < 12; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (game.canDeploy(r, bx+dx, by+dy)) return [(bx+dx+1.5)*32, (by+dy+1.5)*32]; return [r.x, r.y]; }}""")
    pos = scr(*dp)
    if not touch: page.mouse.move(pos['x'], pos['y'])
    page.evaluate(f"() => ui.hoverWorld = {{x:{dp[0]}, y:{dp[1]}}}"); page.wait_for_timeout(200)
    if pre: page.screenshot(path=f'{pre}-deploy-preview.png')
    tapw(*dp); page.wait_for_timeout(4600)
    if pre: page.screenshot(path=f'{pre}-unfold.png')
    R['ui_deployed'] = page.evaluate("() => game.buildings.filter(b=>b.team===0&&['cy','barracks','factory','power'].includes(b.type)).length >= 4 && !game.units.some(u=>u.team===0&&u.carried)")
    page.evaluate("() => { const c = game.buildings.find(b=>b.team===0&&b.type==='cy'); c.age = 9; ui.selection.clear(); ui.selection.add(c); }"); page.wait_for_timeout(200)
    btn('pack'); page.wait_for_timeout(3300)
    R['ui_packedMcv'] = page.evaluate(f"() => {sel}?.type === 'mcv'")
    if pre: page.screenshot(path=f'{pre}-mcv.png')
    R['audio_unlockedAfterTap'] = page.evaluate("() => !!sound.ctx && sound.ctx.state === 'running'") or (bname == 'firefox' and page.evaluate("() => !!sound.ctx"))  # headless Firefox has no audio device: context created, stays suspended
    R['audio_state'] = page.evaluate("() => sound.ctx?.state")
    lv = page.evaluate("() => sound.level"); vb = page.locator('#volBtn'); vb.tap() if touch else vb.click()
    R['audio_volumeCycles'] = page.evaluate("() => sound.level") == (lv + 1) % 4
    errs_before_reload = len(errs); page.reload(); page.wait_for_timeout(800)
    R['audio_volumeRemembered'] = page.evaluate("() => sound.level") == (lv + 1) % 4
    R['audio_notStartedBeforeTap'] = page.evaluate("() => !sound.ctx")
    R['version'] = page.title()
    R['consoleErrors'] = errs
    br.close(); return R

with sync_playwright() as p:
    out = {}
    for bname in ['chromium', 'firefox', 'webkit']:
        for vname, opt in [('desktop', dict(viewport={'width': 1366, 'height': 800})),
                           ('phone', dict(viewport={'width': 390, 'height': 844}, has_touch=True, device_scale_factor=2, **({} if bname == 'firefox' else {'is_mobile': True})))]:
            try: out[f'{bname}-{vname}'] = run(p, bname, vname, opt)
            except Exception as e: out[f'{bname}-{vname}'] = {'EXCEPTION': str(e)[:400]}
    print(json.dumps(out, indent=1))
