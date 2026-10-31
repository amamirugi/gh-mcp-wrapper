export const config = { runtime: 'edge' };
import { cors } from '../lib/base.js';
import { isAllowedRedirectUri } from '../lib/oauth.js';

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() });

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || !redirectUris.every(isAllowedRedirectUri)) {
    return Response.json(
      { error: 'invalid_redirect_uri', error_description: 'redirect_uri not allowed' },
      { status: 400, headers: cors() }
    );
  }

  // Single-user server: we don't persist clients. /authorize re-checks the
  // redirect_uri allowlist, so the issued client_id carries no privilege.
  const clientId = 'mcp_' + crypto.randomUUID();
  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: body.client_name || 'client'
    },
    { status: 201, headers: cors() }
  );
}
