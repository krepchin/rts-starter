const root = process.argv[2];
const { Game } = await import(root + '/src/engine/game.js');
const T=32, G=new Game(); G.fog.enabled=false;
const mine=[G.spawnUnit('carrier',0,30*T,30*T)]; for(let i=0;i<4;i++) mine.push(G.spawnUnit('infantry',0,(29+i)*T,32*T)); for(let i=0;i<2;i++) mine.push(G.spawnUnit('tank',0,(30+i)*T,33*T));
const home=mine.map(u=>({x:u.x,y:u.y}));
const foes=[]; for(let i=0;i<3;i++) foes.push(G.spawnUnit('tank',1,(40+i)*T,(36)*T)); for(let i=0;i<4;i++) foes.push(G.spawnUnit('infantry',1,(40+i)*T,(38)*T));
for(const f of foes) f.command({type:'attackMove',x:30*T,y:30*T});
let maxd = 0;
for(let s=0;s<30*180;s++){ G.update(1/30);
  if(s===30*12) for(const f of G.units) if(f.team===1&&f.type!=='interceptor') f.command({type:'move',x:84*T,y:84*T}); // raid breaks off and runs home
  mine.forEach((u,i)=>{ if(!u.dead) maxd=Math.max(maxd, Math.hypot(u.x-home[i].x,u.y-home[i].y)/T); });
}
const out = mine.map((u,i)=>`${u.type}${u.dead?'(dead)':''}@(${(u.x/T).toFixed(0)},${(u.y/T).toFixed(0)}) ${(Math.hypot(u.x-home[i].x,u.y-home[i].y)/T).toFixed(0)}t`).join(' ');
console.log(root.includes('pages')?'OLD v6:':'NEW v7:', 'max drift', maxd.toFixed(0),'tiles | final', out);
