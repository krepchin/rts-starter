import sys, json
from playwright.sync_api import sync_playwright
URL=sys.argv[1]
JS=r"""
async () => {
  const sb = document.querySelector('#sidebar'); let muts = 0, attrs = 0;
  const mo = new MutationObserver(l => { for (const m of l) { if (m.type === 'attributes') attrs++; else muts++; } });
  mo.observe(sb, { subtree: true, childList: true, characterData: true, attributes: true });
  const ids = ['#queueCtl', '#qStatus', '#selInfo', '#selActions', '#buildTabs'];
  const pos = {}; ids.forEach(i => pos[i] = new Set());
  const widths = new Set();
  const g = window.game, t = g.teams[0]; t.credits = 5000;
  g.addBuilding('barracks', 0, 6, 10).age = 9;
  // exercise: queue infantry, toggle low power, select building, arm sell
  for (let f = 0; f < 120; f++) {
    if (f === 10) { for (let i=0;i<3;i++) g.enqueue(0,'infantry',false); }
    if (f === 40) { g.addBuilding('radar',0,10,6).age=9; g.addBuilding('radar',0,13,6).age=9; } // low power
    if (f === 60) { window.ui.select(g.buildings.find(b=>b.type==='barracks')); }
    if (f === 80) { document.querySelectorAll('#selActions button')[1]?.click(); }
    if (f === 100) { window.ui.clearSelection(); }
    await new Promise(r => requestAnimationFrame(r));
    for (const i of ids) { const r = document.querySelector(i).getBoundingClientRect(); pos[i].add(Math.round(r.top) + 'x' + Math.round(r.height)); }
    document.querySelectorAll('#buildTabs button, #selActions button').forEach(b => widths.add(b.textContent + ':' + Math.round(b.getBoundingClientRect().width)));
  }
  mo.disconnect();
  return { mutationsPer120Frames: muts, attrChanges: attrs, layoutStates: Object.fromEntries(ids.map(i => [i, [...pos[i]]])), buttonWidths: [...widths] };
}
"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/google/chrome/chrome')
    for name,ctx in (('desktop',{'viewport':{'width':1366,'height':800}}),('iphone',dict(p.devices['iPhone 13']))):
        c=b.new_context(**ctx); pg=c.new_page(); pg.goto(URL+'?autostart=1'); pg.wait_for_timeout(1500)
        print(name, json.dumps(pg.evaluate(JS), indent=0)); c.close()
    b.close()
