/* WikiWeb service worker: app works offline, articles you've read stay readable */
const V = 'wg-v1';
/* offline settings from the page ({all, img}); kept in a cache so they survive service-worker restarts */
let CFG = null;
async function cfg() {
  if (CFG) return CFG;
  try { const r = await (await caches.open(V + '-cfg')).match('cfg'); CFG = r ? await r.json() : {}; } catch (e) { CFG = {}; }
  return CFG;
}
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'cfg') { CFG = e.data.cfg || {}; e.waitUntil(caches.open(V + '-cfg').then(c => c.put('cfg', new Response(JSON.stringify(CFG))))); }
});
const isImg = u => u.hostname === 'upload.wikimedia.org' || (u.hostname === 'wikimedia.org' && u.pathname.startsWith('/api/rest_v1/media/math/'));
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg?v=4', 'icons/apple-touch-icon.png?v=4', 'icons/icon-192.png?v=4', 'icons/icon-512.png?v=4', 'icons/favicon-32.png?v=4'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V + '-shell').then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(V)).map(k => caches.delete(k)))).then(migrateArticles).then(() => self.clients.claim()));
});
/* articles are stored under host + page only, so changing the request parameters (e.g. adding prop=langlinks)
   never makes saved articles unreachable offline again */
const artKey = u => u.origin + '/w/api.php?action=parse&page=' + encodeURIComponent((u.searchParams.get('page') || '').replace(/_/g, ' '));
const isParse = u => /\.wikipedia\.org$/.test(u.hostname) && u.pathname.endsWith('/api.php') && u.searchParams.get('action') === 'parse';
async function migrateArticles() {   // one-time per activation: move entries stored under the full request URL to artKey
  try {
    const c = await caches.open(V + '-articles');
    for (const k of await c.keys()) {
      const u = new URL(k.url), nk = artKey(u);
      if (!isParse(u) || k.url === nk) continue;
      if (!(await c.match(nk))) { const r = await c.match(k); if (r) await c.put(nk, r); }
      await c.delete(k);
    }
  } catch (e) {}
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) { e.respondWith(netFirst(req, V + '-shell', 2500)); return; }
  if (/\.wikipedia\.org$/.test(u.hostname)) {
    const parse = isParse(u);
    const summary = u.pathname.includes('/rest_v1/page/summary/');
    if (parse) e.respondWith(cfg().then(c => netFirst(req, V + '-articles', 5000, c.all ? 0 : 600, artKey(u))));   // "alles offline": no limit
    else if (summary) e.respondWith(netFirst(req, V + '-previews', 4000, 400));
  }
  if (isImg(u)) { e.respondWith(cfg().then(c => c.img ? imgFirst(req) : fetch(req))); return; }
  if (u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/wikigraph/clickstream/')) e.respondWith(netFirst(req, V + '-clickstream', 5000, 600));
});

/* network first (fresh content), cache as fallback when offline or slow */
async function netFirst(req, name, timeout, max, key = req) {
  const cache = await caches.open(name);
  const net = fetch(req).then(res => {
    if (res && res.ok) { const c = res.clone(); cache.delete(key).then(() => cache.put(key, c)).then(() => max && trim(cache, max)); }
    return res;
  });
  net.catch(() => {});
  let timer;
  const to = new Promise(r => { timer = setTimeout(r, timeout, 'TIMEOUT'); });
  try {
    const r = await Promise.race([net, to]);
    if (r !== 'TIMEOUT') { clearTimeout(timer); return r; }
  } catch (e) {}
  const hit = (await cache.match(key)) || (key !== req && (await cache.match(req))) || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('index.html')) : null);
  if (hit) return hit;
  return net;
}
/* images never change under the same URL: cache first. Fetched with CORS so the stored size is the real size */
async function imgFirst(req) {
  const cache = await caches.open(V + '-images');
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (res.ok) cache.put(req.url, res.clone());
    return res;
  } catch (e) {
    // offline and this exact size isn't stored: use another stored size of the same image (…/220px-X.jpg vs …/330px-X.jpg)
    const base = imgBase(req.url);
    for (const k of await cache.keys()) if (imgBase(k.url) === base) return cache.match(k);
    return fetch(req);
  }
}
const imgBase = u => u.replace(/\/thumb\//, '/').replace(/\/(\d+px|lossy-page\d+-\d+px|page\d+-\d+px)-[^/]+$/, '');
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
