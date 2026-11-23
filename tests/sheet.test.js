// Smoke test: "Gelesene Nachbarn" in the info card — Hier/Dort buttons across merged language versions, reason text for click-only neighbours.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://frechmax.github.io/wikigraph/#search',
 beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(t,p)=>p==='measureText'?()=>({width:40}):(typeof p==='string'?(t[p]!==undefined?t[p]:()=>{}):undefined), set:(t,p,v)=>{t[p]=v;return true;}});
  w.matchMedia=()=>({matches:false,addEventListener(){}}); w.fetch=async()=>({ok:false,json:async()=>({})}); w.requestAnimationFrame=f=>setTimeout(()=>f(Date.now()),5); w.onerror=(m,s,l)=>console.log('ERR',m,l); }});
const w=dom.window;
setTimeout(async()=>{ try{
 // en:Roman Empire read first, de:Römisches Reich later (same QID) -> merged, main = en. de:Fasan links only the German version.
 w.eval(`(()=>{const now=Date.now(); db.onboarded=1; db.tips={_off:1}; db.nodes={}; db.edges=[];
  const N=(l,t,o,q,f)=>db.nodes[l+':'+t]={title:t,lang:l,visits:[f],first:f,last:f,out:o,qid:q};
  N('en','Roman Empire',['Augustus'],'Q2277',now-5e6); N('de','Römisches Reich',['Augustus'],'Q2277',now-4e6);
  N('de','Fasan',['Römisches Reich','Hühnervögel'],'Q1',now-3e6); N('de','Kaffee',['Bohne'],'Q2',now-2e6);
  db.edges.push({f:'de:Fasan',t:'de:Kaffee',ts:now-2e6});
  db.view={start:'all'}; current=null; save(); G.dirty=true; location.hash='#graph'; })()`);
 await new Promise(r=>setTimeout(r,500));
 const rows=k=>w.eval(`(()=>{ select(G.by.get(${JSON.stringify(k)})); return [...document.querySelectorAll('#sheet .spot')].map(r=>r.querySelector('.sname').textContent+' ['+[...r.querySelectorAll('.sgo')].map(b=>b.textContent.trim()+'@'+b.dataset.go).join(' ')+'] '+(r.querySelector('.swhy')||{}).textContent).join(' | '); })()`);
 console.log('main of de:Römisches Reich:', w.eval(`resolve('de:Römisches Reich')`));
 console.log('Fasan:', rows('de:Fasan'));
 console.log('Roman Empire:', rows('en:Roman Empire'));
 console.log('Kaffee:', rows('de:Kaffee'));
}catch(e){console.log('EXC',e.stack)} process.exit(0); },700);
