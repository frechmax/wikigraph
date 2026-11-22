// WikiWeb – GitHub-Login (Device Flow) als Vercel Function.
// Leitet nur die zwei Device-Flow-Aufrufe an GitHub weiter, weil GitHub dafür kein CORS erlaubt.
// Kein Secret nötig, speichert nichts. Umgebungsvariable in Vercel: CLIENT_ID (Client ID der GitHub OAuth App).
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('nur POST', { status: 405 });
  if (!process.env.CLIENT_ID) return Response.json({ error: 'server_config', error_description: 'CLIENT_ID fehlt in Vercel' }, { status: 500 });

  const step = new URL(req.url).searchParams.get('step');
  const params = { client_id: process.env.CLIENT_ID };
  let target;
  if (step === 'device') {
    target = 'https://github.com/login/device/code';
    params.scope = 'gist';
  } else if (step === 'token') {
    const body = await req.json().catch(() => ({}));
    if (!body.device_code) return Response.json({ error: 'bad_request', error_description: 'device_code fehlt' }, { status: 400 });
    target = 'https://github.com/login/oauth/access_token';
    params.device_code = body.device_code;
    params.grant_type = 'urn:ietf:params:oauth:grant-type:device_code';
  } else return new Response('unbekannt', { status: 404 });

  const r = await fetch(target, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'wikigraph' },
    body: JSON.stringify(params),
  });
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
