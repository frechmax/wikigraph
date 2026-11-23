// Smoke test: open a German article, switch to English and back via the language button (Wikipedia API stubbed).
const {JSDOM}=require('jsdom'); const fs=require('fs');
const P={de:{'Graphentheorie':{title:'Graphentheorie',text:'<div class="mw-parser-output"><p>Die <b>Graphentheorie</b> ist ein Teilgebiet der Mathematik. Siehe <a href="/wiki/Leonhard_Euler">Euler</a>.</p></div>',links:[{ns:0,title:'Leonhard Euler',exists:true}],properties:{wikibase_item:'Q131476'},langlinks:[{lang:'en',title:'Graph theory',autonym:'English'},{lang:'fr',title:'Théorie des graphes',autonym:'français'}]}},
 en:{'Graph theory':{title:'Graph theory',text:'<div class="mw-parser-output"><p><b>Graph theory</b> is the study of graphs. See <a href="/wiki/Leonhard_Euler">Euler</a>.</p></div>',links:[{ns:0,title:'Leonhard Euler',exists:true}],properties:{wikibase_item:'Q131476'},langlinks:[{lang:'de',title:'Graphentheorie',autonym:'Deutsch'},{lang:'fr',title:'Théorie des graphes',autonym:'français'}]}}};
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://frechmax.github.io/wikigraph/#search',
 beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(t,p)=>p==='measureText'?()=>({width:40}):(typeof p==='string'?(t[p]!==undefined?t[p]:()=>{}):undefined), set:(t,p,v)=>{t[p]=v;return true;}}); w.matchMedia=()=>({matches:false,addEventListener(){}}); w.requestAnimationFrame=f=>setTimeout(()=>f(Date.now()),5); w.onerror=(m,s,l)=>console.log('ERR',m,l);
  w.fetch=async(u)=>{ const U=new URL(String(u)); const lang=U.hostname.split('.')[0];
   if(U.searchParams.get('action')==='parse'){ const p=P[lang]&&P[lang][U.searchParams.get('page')]; return p?{ok:true,json:async()=>({parse:p})}:{ok:true,json:async()=>({error:{code:'missingtitle'}})}; }
   return {ok:false,status:404,json:async()=>({})}; }; }});
const w=dom.window, d=w.document, T=ms=>new Promise(r=>setTimeout(r,ms));
const state=l=>console.log(l, '| hash', decodeURIComponent(w.location.hash), '| title', d.getElementById('rtitle').textContent, '| text', d.getElementById('article').textContent.replace(/\s+/g,' ').slice(0,45), '| btn', d.getElementById('langBtn').textContent);
const pick=async lang=>{ d.getElementById('langBtn').click(); const rows=[...d.querySelectorAll('#popbody [data-l]')].map(b=>b.dataset.l); console.log('   list:', rows.join(',')); d.querySelector(`#popbody [data-l="${lang}"]`).click(); await T(300); };
setTimeout(async()=>{ try{
 w.eval(`db.onboarded=1; db.tips={_off:1}; db.tipPreview=1; save(); openTitle('de','Graphentheorie',null)`); await T(400); state('DE  ');
 await pick('en'); state('→EN');
 await pick('de'); state('→DE');
 await pick('en'); state('→EN');
 console.log('nodes:', Object.keys(w.eval('db.nodes')).join(', '), '| graph main:', w.eval(`resolve('en:Graph theory')`));
}catch(e){console.log('EXC',e.stack)} process.exit(0);},500);
