export const config = { runtime: 'edge' };
import { sign } from '../lib/token.js';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formHtml(params, error) {
  const fields = [
    'response_type',
    'client_id',
    'redirect_uri',
    'code_challenge',
    'code_challenge_method',
    'state',
    'scope',
    'resource'
  ]
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params.get(k))}">`)
    .join('\n');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize</title>
<style>
:root{color-scheme:dark light}
body{font-family:system-ui,-apple-system,sans-serif;background:#111;color:#eee;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#1b1b1b;border:1px solid #333;border-radius:12px;padding:28px;width:320px}
h1{font-size:16px;font-weight:500;margin:0 0 4px}
p{font-size:13px;color:#999;margin:0 0 20px}
input[type=password]{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;
border:1px solid #444;background:#0e0e0e;color:#eee;font-size:14px}
button{width:100%;margin-top:14px;padding:10px;border-radius:8px;border:1px solid #555;
background:#2a2a2a;color:#eee;font-size:14px;cursor:pointer}
button:hover{background:#333}
.err{color:#e88;font-size:13px;margin:10px 0 0}
</style></head><body>
<form class="card" method="POST" action="/authorize">
<h1>GitHub MCP</h1>
<p>Enter the access password to connect.</p>
${fields}
<input type="password" name="password" placeholder="password" autofocus autocomplete="off">
${error ? `<div class="err">${esc(error)}</div>` : ''}
<button type="submit">Authorize</button>
</form></body></html>`;
}

export default async function handler(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return new Response(formHtml(url.searchParams), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  if (request.method === 'POST') {
    const form = await request.formData();
    const params = new URLSearchParams();
    for (const [k, v] of form.entries()) params.set(k, v);

    if (form.get('password') !== process.env.AUTH_PASSWORD) {
      return new Response(formHtml(params, 'Wrong password.'), {
        status: 401,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    const redirectUri = form.get('redirect_uri');
    if (!redirectUri) return new Response('missing redirect_uri', { status: 400 });

    const code = await sign(
      {
        typ: 'code',
        cc: form.get('code_challenge') || '',
        ru: redirectUri,
        scope: form.get('scope') || 'mcp'
      },
      process.env.SIGNING_SECRET,
      600
    );

    const dest = new URL(redirectUri);
    dest.searchParams.set('code', code);
    const state = form.get('state');
    if (state) dest.searchParams.set('state', state);
    return Response.redirect(dest.toString(), 302);
  }

  return new Response('Method Not Allowed', { status: 405 });
}
