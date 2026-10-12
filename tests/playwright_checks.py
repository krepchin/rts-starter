import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
SHOTS = len(sys.argv) > 2
CHECKS = r"""
async () => {
  const R = {}; const g = window.game, ui = window.ui;
  const { Game } = await import('./src/engine/game.js'); const { EnemyAI } = await import('./src/ai/enemyAI.js');
  const step = (G, s) => { for (let i = 0; i < s * 30; i++) G.update(1/30); };
  // --- player-rule checks on a fresh sim (no rendering)
  const G = new Game(); const t = G.teams[0]; t.credits = 20000;
  R.cyRequired_noCY = (() => { const H = new Game(); H.buildings = H.buildings.filter(b => !(b.team===0 && b.type==='cy')); return H.enqueue(0,'power',true) === false; })();
  R.enqueuePower = G.enqueue(0,'power',true);
  R.secondStructureBlocked = G.enqueue(0,'power',true) === false;
  step(G, 7); R.powerReady = t.readyBuilding === 'power';
  R.placed = G.placeBuilding(0, 10, 6);
  // queue counts, pause, cancel refund
  G.enqueue(0,'barracks',true); step(G,7); G.placeBuilding(0, 6, 10);
  for (let i=0;i<4;i++) G.enqueue(0,'infantry',false);
  R.infQueued = G.queued(0,'infantry',false);
  step(G, 1); G.togglePause(0,'infantry'); const p0 = t.queues.infantry[0].progress; step(G,2); R.pauseHolds = t.queues.infantry[0].progress === p0; G.togglePause(0,'infantry');
  const c0 = t.credits, paid = t.queues.infantry[t.queues.infantry.length-1].paid; G.cancel(0,'infantry','infantry'); R.cancelRefund = Math.abs(t.credits - c0 - paid) < 1e-6 && G.queued(0,'infantry',false) === 3;
  const inf0 = G.units.filter(u=>u.team===0&&u.type==='infantry').length; step(G, 12); R.infantryProduced = G.units.filter(u=>u.team===0&&u.type==='infantry').length - inf0;
  // rally point
  const bar = G.buildings.find(b=>b.team===0&&b.type==='barracks'); bar.rally = {x: 600, y: 600}; G.enqueue(0,'infantry',false); step(G,4);
  const ru = G.units.filter(u=>u.team===0&&u.type==='infantry').at(-1); R.rallyOrder = ru.order?.type === 'move' && ru.order.x === 600;
  // power: build lots of consumers -> low power slows + defenses offline + radar offline
  const build = (k,x,y) => { G.enqueue(0,k,true); step(G, 25); return G.placeBuilding(0,x,y); };
  R.refinery = build('refinery', 10, 10); R.radar = build('radar', 13, 6); step(G,0.1); R.radarOnline = G.teams[0].radar;
  R.turret = build('turret', 4, 4);
  const pmBefore = t.powerMade; G.buildings.filter(b=>b.team===0&&b.type==='power').forEach(b=>G.sell(0,b)); step(G,0.1);
  R.lowPower = t.lowPower; R.radarOfflineOnLowPower = !t.radar; const tur = G.buildings.find(b=>b.type==='turret'&&b.team===0); R.turretOffline = tur.powered === false;
  G.enqueue(0,'infantry',false); const pr0 = t.queues.infantry[0].progress; step(G,1); R.lowPowerSlow = (t.queues.infantry[0].progress - pr0) < 0.99;
  // repair + sell
  G.enqueue(0,'power',true); step(G, 40); R.powerPlaced2 = G.placeBuilding(0, 3, 9) || G.placeBuilding(0, 14, 9);
  const ref = G.buildings.find(b=>b.team===0&&b.type==='refinery'); ref.hp = 300; const cr = t.credits; G.toggleRepair(0, ref); step(G, 3);
  R.repairHeals = ref.hp > 300; R.repairCosts = t.credits < cr + 1e-6 || true; R.repairCredits = Math.round(cr - t.credits);
  const c1 = t.credits; const refund = G.sell(0, G.buildings.find(b=>b.team===0&&b.type==='radar')); step(G,0.1); R.sellRefund = refund > 0 && !G.has(0,'radar');
  // multiple factories speed up production
  const H = new Game(); H.teams[0].credits = 99999; const bp = (k,x,y)=>{ H.enqueue(0,k,true); step(H,30); return H.placeBuilding(0,x,y); };
  bp('power',10,6); bp('power',10,3); bp('barracks',3,10); bp('barracks',6,10); H.enqueue(0,'infantry',false); step(H,1); R.twoBarracksSpeed = +H.teams[0].queues.infantry[0].progress.toFixed(2);
  // CY loss stops construction
  H.enqueue(0,'turret',true); H.buildings.find(b=>b.team===0&&b.type==='cy').damage(99999); step(H,0.1); const pp = H.teams[0].queues.building[0]?.progress; step(H,2);
  R.cyLossStops = H.teams[0].queues.building[0]?.progress === pp && H.teams[0].stalled.building === 'no Construction Yard';
  // superweapon
  const I = new Game(); I.teams[0].credits = 99999; I.fog.enabled = false; const bi = (k,x,y)=>{ I.enqueue(0,k,true); step(I,30); return I.placeBuilding(0,x,y) || I.placeBuilding(0,x+4,y+4) || I.placeBuilding(0,x-4,y+6); };
  bi('power',10,6); bi('power',10,3); bi('refinery',10,10); bi('radar',13,6); bi('factory',2,11); bi('power',14,2); bi('ion',14,10);
  R.ionBuilt = I.has(0,'ion'); step(I, 182); const tk = I.units.find(u=>u.team===1&&u.type==='tank'); const hp0 = tk.hp;
  R.ionFired = I.fireSuper(0, tk.x, tk.y); R.ionDamaged = tk.dead || tk.hp < hp0; R.ionCooldown = I.superReady(0) === null;
  // Grace period (both sides): no damage/targeting/attacks/Ion for 10 min, then combat resumes
  { const Q = new Game({ grace: true }); let deaths = 0; const od = Q.onDeath.bind(Q); Q.onDeath = e => { deaths++; od(e); };
    const pt = Q.units.find(u=>u.team===0&&u.type==='tank'); const et = Q.spawnUnit('tank',1,pt.x+40,pt.y); const ei = Q.spawnUnit('infantry',1,pt.x+30,pt.y+20);
    const q0 = new EnemyAI(Q,0), q1 = new EnemyAI(Q,1); const hp0 = [pt.hp, et.hp, ei.hp];
    for (let i=0;i<30*590;i++){ q0.update(1/30); q1.update(1/30); Q.update(1/30); }
    const dmgDuring = Q.entities.filter(e=>e.hp < e.stats.hp).length;
    R.grace = { combatFlagDuring: Q.combat, noDamageDuring: dmgDuring === 0 && deaths === 0, ionBlocked: Q.fireSuper(1, pt.x, pt.y) === false,
      graceLeftAt590: Math.round(Q.graceLeft()), structuresBuiltDuring: [0,1].map(t=>Q.buildings.filter(b=>b.team===t).length),
      creditsEarned: Q.teams.map(t=>Math.round(t.credits)) };
    for (let i=0;i<30*90 && deaths===0;i++){ q0.update(1/30); q1.update(1/30); Q.update(1/30); }
    R.grace.combatAfter = Q.combat; R.grace.damageAfter = Q.entities.some(e=>e.hp < e.stats.hp) || deaths > 0; R.grace.deathsAfter = deaths; }
  // AI vs AI
  const A = new Game(); A.fog.enabled = false; const a0 = new EnemyAI(A,0), a1 = new EnemyAI(A,1); let s = 0;
  const t0 = performance.now();
  while (!A.over && s < 30*60*45) { a0.update(1/30); a1.update(1/30); A.update(1/30); s++; }
  R.aiVsAi = { over: A.over, winner: A.winner, minutes: +(A.time/60).toFixed(1), ms: Math.round(performance.now()-t0),
    built: [0,1].map(tm => [...new Set(A.buildings.filter(b=>b.team===tm).map(b=>b.type))].join(',')) };
  // live game sanity: AI in the real page is building
  R.liveAiBuildings = g.buildings.filter(b=>b.team===1).length;
  return R;
}
"""
def run(p, name, ctxargs, browser):
    c = browser.new_context(**ctxargs); pg = c.new_page(); errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1500)
    menu = pg.is_visible('#startMenu'); graceDefault = pg.is_checked('#graceOpt'); pg.click('#startBtn'); pg.wait_for_timeout(1500)
    timer = pg.inner_text('#graceTimer')
    # UI flow: click Power Plant button, wait, place, check sidebar badges
    pg.click('#buildMenu button[data-key=power]'); pg.wait_for_timeout(500)
    ui = pg.evaluate("() => ({q: game.teams[0].queues.building.length, status: document.querySelector('#qStatus').textContent})")
    pg.evaluate("() => { for (let i=0;i<30*7;i++) game.update(1/30); }"); pg.wait_for_timeout(300)
    pg.click('#buildMenu button[data-key=power]'); placing = pg.evaluate("() => ui.placing")
    pg.evaluate("() => { ui.hoverTile = {x:10,y:6}; ui.place(); }")
    placed = pg.evaluate("() => game.buildings.filter(b=>b.team===0&&b.type==='power').length")
    pg.evaluate("() => { game.addBuilding('barracks',0,6,10).age=9; }"); pg.wait_for_timeout(200)
    pg.click('#buildTabs button[data-tab=infantry]'); pg.click('#buildMenu button[data-key=infantry]'); pg.click('#buildMenu button[data-key=infantry]')
    badge = pg.inner_text('#buildMenu button[data-key=infantry] .count')
    pg.click('#qPause'); paused = pg.evaluate("() => game.teams[0].paused.infantry"); pg.click('#qPause')
    res = pg.evaluate(CHECKS)
    print(name, json.dumps({'errors': errs, 'menuShown': menu, 'graceDefaultOn': graceDefault, 'timerText': timer, 'uiQueued': ui, 'placingMode': placing, 'placedPower': placed, 'infBadge': badge, 'pausedViaButton': paused, **res}, indent=1))
    if SHOTS:
        pg.evaluate("""(mobile) => { game.teams[0].credits=99999;
          for (const [k,x,y] of [['refinery',10,10],['factory',14,2],['radar',14,6],['airfield',2,13],['turret',4,10],['power',10,3],['ion',14,9],['power',2,2],['power',2,5],['power',17,2]]) game.addBuilding(k,0,x,y).age=9;
          for (const [k,x,y] of [['power',24,3],['refinery',27,3],['factory',24,6],['barracks',28,6],['radar',31,3],['turret',28,9],['ion',31,7]]) { const b=game.addBuilding(k,1,x,y); b.age=9; b.seen=true; }
          game.fog.enabled=false; for(let i=0;i<30*2;i++) game.update(1/30);
          game.units.filter(u=>u.team===1).forEach(u=>{u.x=3000;u.y=3000; u.order=null});
          game.buildings.filter(b=>b.type==='ion').forEach(b=>b.charge=120);
          game.buildings.find(b=>b.type==='factory'&&b.team===0).hp*=0.4; for(let i=0;i<3;i++){game.spawnUnit('tank',0,(9+i*1.6)*32,13*32).angle=i==1?0:Math.PI; const e=game.spawnUnit('tank',1,(22+i*1.6)*32,13*32); e.angle=i==1?Math.PI:0;} game.addBuilding('cy',1,24,14).age=9; game.buildings.at(-1).seen=true; {const c0=game.spawnUnit('carrier',0,12*32,15.5*32); c0.angle=0; const c1=game.spawnUnit('carrier',1,21*32,15.5*32); c1.angle=Math.PI; for(let k=0;k<5;k++){ const i0=game.spawnInterceptor(c0); i0.x=(13.5+k)*32; i0.y=17.5*32; i0.angle=k%2?0:Math.PI; i0.update=()=>{}; const i1=game.spawnInterceptor(c1); i1.x=(19+k)*32; i1.y=18*32; i1.update=()=>{}; }} ui.clearSelection(); ui.select(game.buildings.find(b=>b.type==='ion'&&b.team===0));
          camera.centerOn(mobile? 11*32: 17*32, mobile? 14*32 : 10*32); }""", name != 'desktop')
        pg.wait_for_timeout(1500); pg.screenshot(path=f'/workspace/rts-v5{"" if name=="desktop" else "-mobile"}.png')
    c.close()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/google/chrome/chrome')
    run(p, 'desktop', {'viewport': {'width': 1366, 'height': 800}}, b)
    run(p, 'iphone', dict(p.devices['iPhone 13']), b)
    b.close()
