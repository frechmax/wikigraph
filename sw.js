/* WikiGraph service worker: app works offline, articles you've read stay readable */
const V = 'wg-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg?v=4', 'icons/apple-touch-icon.png?v=4', 'icons/icon-192.png?v=4', 'icons/icon-512.png?v=4', 'icons/favicon-32.png?v=4'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V + '-shell').then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(V)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) { e.respondWith(netFirst(req, V + '-shell', 2500)); return; }
  if (/\.wikipedia\.org$/.test(u.hostname)) {
    const parse = u.pathname.endsWith('/api.php') && u.searchParams.get('action') === 'parse';
    const summary = u.pathname.includes('/rest_v1/page/summary/');
    if (parse) e.respondWith(netFirst(req, V + '-articles', 5000, 600));
    else if (summary) e.respondWith(netFirst(req, V + '-previews', 4000, 400));
  }
});

/* network first (fresh content), cache as fallback when offline or slow */
async function netFirst(req, name, timeout, max) {
  const cache = await caches.open(name);
  const net = fetch(req).then(res => {
    if (res && res.ok) { const c = res.clone(); cache.delete(req).then(() => cache.put(req, c)).then(() => max && trim(cache, max)); }
    return res;
  });
  net.catch(() => {});
  let timer;
  const to = new Promise(r => { timer = setTimeout(r, timeout, 'TIMEOUT'); });
  try {
    const r = await Promise.race([net, to]);
    if (r !== 'TIMEOUT') { clearTimeout(timer); return r; }
  } catch (e) {}
  const hit = (await cache.match(req)) || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('index.html')) : null);
  if (hit) return hit;
  return net;
}
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
