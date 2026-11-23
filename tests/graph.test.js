// Smoke test: builds a synthetic 60-article graph and runs the layouts (net, relayout, time, back to net).
// Run: npm test   (needs `npm i` once for jsdom)
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://frechmax.github.io/wikigraph/#search',
 beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(t,p)=>p==='measureText'?()=>({width:40}):(typeof p==='string'?(t[p]!==undefined?t[p]:()=>{}):undefined), set:(t,p,v)=>{t[p]=v;return true;}});
  w.matchMedia=()=>({matches:false,addEventListener(){}}); w.fetch=async()=>({ok:false,json:async()=>({})}); w.requestAnimationFrame=f=>setTimeout(()=>f(Date.now()),5); w.onerror=(m,s,l)=>console.log('ERR',m,l); }});
const w=dom.window;
setTimeout(async()=>{ try{
 w.eval(`(()=>{const now=Date.now(),D=864e5; db.onboarded=1; db.tips={_off:1}; db.nodes={}; db.edges=[];
  for(let g=0;g<4;g++) for(let i=0;i<15;i++){ const t='G'+g+'_'+i; const out=[]; for(let j=0;j<15;j++) if(j!==i && Math.random()<.4) out.push('G'+g+'_'+j); if(Math.random()<.15) out.push('G'+((g+1)%4)+'_'+Math.floor(Math.random()*15)); out.push('Ext'+g+'_'+(i%3));
   const f=now-(g*15+i)*D; db.nodes['de:'+t]={title:t,lang:'de',visits:[f],first:f,last:f,out}; }
  for(let i=0;i<40;i++){ const a='G'+(i%4)+'_'+(i%15), b='G'+(i%4)+'_'+((i+1)%15); db.edges.push({f:'de:'+a,t:'de:'+b,ts:now}); }
  db.view={start:'all'}; current=null; save(); G.dirty=true; location.hash='#graph'; })()`);
 await new Promise(r=>setTimeout(r,500));
 const sep=()=>w.eval(`(()=>{ const cs=new Map(); G.nodes.filter(n=>!n.ghost&&n.cl>=0).forEach(n=>{ if(!cs.has(n.cl)) cs.set(n.cl,[]); cs.get(n.cl).push(n); }); let intra=0,ni=0; const cen=[]; for(const m of cs.values()){ const cx=m.reduce((s,n)=>s+n.x,0)/m.length, cy=m.reduce((s,n)=>s+n.y,0)/m.length; cen.push([cx,cy]); m.forEach(n=>{intra+=Math.hypot(n.x-cx,n.y-cy); ni++;}); } let inter=0,nn=0; for(let i=0;i<cen.length;i++) for(let j=i+1;j<cen.length;j++){ inter+=Math.hypot(cen[i][0]-cen[j][0],cen[i][1]-cen[j][1]); nn++; } let ov=0; const N=G.nodes; for(let i=0;i<N.length;i++) for(let j=i+1;j<N.length;j++) if(Math.hypot(N[i].x-N[j].x,N[i].y-N[j].y)<N[i].r+N[j].r) ov++; return JSON.stringify({clusters:cs.size, intra:Math.round(intra/ni), inter:Math.round(inter/Math.max(1,nn)), overlaps:ov}); })()`);
 w.eval(`for(let i=0;i<300;i++) tick();`); console.log('before (no islands sim):', sep());
 w.eval(`untangle(true); for(let i=0;i<600;i++) tick();`); console.log('after relayout:', sep(), 'boost', w.eval('G.boost.toFixed(2)'));
 w.eval(`setLayout('time'); for(let i=0;i<200;i++) tick(); draw();`); console.log('time lanes', w.eval('JSON.stringify(G.lanes.map(l=>l.name))'), 'ticks', w.eval('G.ticks.length'), sep());
 w.eval(`document.getElementById('gUntangle').click(); for(let i=0;i<50;i++) tick(); document.getElementById('gFilter').click(); console.log(document.getElementById('popbody').querySelectorAll('.chip').length); document.querySelector('[data-t="v:ghostLines"]').click(); document.querySelector('[data-t="v:layout:net"]').click(); db.view.layout='radial'; console.log('vw',VW().layout); for(let i=0;i<100;i++) tick(); draw(); select(G.nodes.find(n=>!n.ghost)); draw();`); console.log('net back ok', sep());
}catch(e){console.log('EXC',e.stack)} process.exit(0); },700);
