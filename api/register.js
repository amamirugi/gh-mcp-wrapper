export const config = { runtime: 'edge' };
import { cors } from '../lib/base.js';

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() });

  let body = {};
  try {
    body = await request.json();
  } catch {}

  // Single-user server: we don't persist clients. The real gate is the
  // password at /authorize, so any registered client_id is acceptable.
  const clientId = 'mcp_' + crypto.randomUUID();
  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris || [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: body.client_name || 'client'
    },
    { status: 201, headers: cors() }
  );
}
