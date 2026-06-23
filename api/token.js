export const config = { runtime: 'edge' };
import { sign, verify, pkceS256 } from '../lib/token.js';
import { cors } from '../lib/base.js';

const ACCESS_TTL = 60 * 60 * 24 * 30; // 30 days
const REFRESH_TTL = 60 * 60 * 24 * 180; // 180 days

function err(code, desc) {
  return Response.json(
    { error: code, error_description: desc || '' },
    { status: 400, headers: cors() }
  );
}

async function issueTokens(scope, secret) {
  const access = await sign({ typ: 'access', scope }, secret, ACCESS_TTL);
  const refresh = await sign({ typ: 'refresh', scope }, secret, REFRESH_TTL);
  return Response.json(
    {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL,
      refresh_token: refresh,
      scope
    },
    { headers: cors() }
  );
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() });

  const secret = process.env.SIGNING_SECRET;
  const form = await request.formData();
  const grant = form.get('grant_type');

  if (grant === 'authorization_code') {
    const code = form.get('code');
    const verifier = form.get('code_verifier');
    const redirectUri = form.get('redirect_uri');

    const claims = await verify(code, secret);
    if (!claims || claims.typ !== 'code') return err('invalid_grant', 'bad or expired code');
    if (claims.ru && redirectUri && claims.ru !== redirectUri)
      return err('invalid_grant', 'redirect_uri mismatch');
    if (claims.cc) {
      if (!verifier) return err('invalid_grant', 'missing code_verifier');
      const challenge = await pkceS256(verifier);
      if (challenge !== claims.cc) return err('invalid_grant', 'PKCE verification failed');
    }
    return issueTokens(claims.scope || 'mcp', secret);
  }

  if (grant === 'refresh_token') {
    const rt = form.get('refresh_token');
    const claims = await verify(rt, secret);
    if (!claims || claims.typ !== 'refresh') return err('invalid_grant', 'bad refresh token');
    return issueTokens(claims.scope || 'mcp', secret);
  }

  return err('unsupported_grant_type', String(grant || ''));
}
