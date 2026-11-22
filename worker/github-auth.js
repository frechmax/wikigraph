// WikiGraph – GitHub-Login-Proxy (Cloudflare Worker)
// Leitet nur die zwei Device-Flow-Aufrufe an GitHub weiter, weil GitHub dafür kein CORS erlaubt.
// Speichert nichts. Umgebungsvariable: CLIENT_ID (Client ID der GitHub OAuth App, Device Flow aktiviert).
const ALLOWED = ['https://frechmax.github.io', 'http://localhost:8765'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || !ALLOWED.includes(origin)) return new Response('nope', { status: 403, headers: cors });

    const path = new URL(req.url).pathname;
    let target, params = { client_id: env.CLIENT_ID };
    if (path === '/device') { target = 'https://github.com/login/device/code'; params.scope = 'gist'; }
    else if (path === '/token') {
      const body = await req.json().catch(() => ({}));
      if (!body.device_code) return new Response('device_code fehlt', { status: 400, headers: cors });
      target = 'https://github.com/login/oauth/access_token';
      params.device_code = body.device_code;
      params.grant_type = 'urn:ietf:params:oauth:grant-type:device_code';
    } else return new Response('not found', { status: 404, headers: cors });

    const r = await fetch(target, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'wikigraph-auth' },
      body: JSON.stringify(params),
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
