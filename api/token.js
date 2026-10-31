export const config = { runtime: 'edge' };
import { sign, verify, pkceS256 } from '../lib/token.js';
import { cors } from '../lib/base.js';
import { tokenVersion } from '../lib/oauth.js';

const ACCESS_TTL = 60 * 60; // 1 hour
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 days, sliding
const MAX_SESSION = 60 * 60 * 24 * 90; // re-enter the password at least every 90 days

function err(code, desc) {
  return Response.json(
    { error: code, error_description: desc || '' },
    { status: 400, headers: cors() }
  );
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function issueTokens(scope, authTime, secret) {
  const kv = tokenVersion();
  const access = await sign({ typ: 'access', kv, scope }, secret, ACCESS_TTL);
  const refreshTtl = Math.min(REFRESH_TTL, authTime + MAX_SESSION - now());
  const refresh = await sign({ typ: 'refresh', kv, scope, at: authTime }, secret, refreshTtl);
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
    const clientId = form.get('client_id');

    const claims = await verify(code, secret);
    if (!claims || claims.typ !== 'code' || claims.kv !== tokenVersion())
      return err('invalid_grant', 'bad or expired code');
    if (!claims.ru || claims.ru !== redirectUri) return err('invalid_grant', 'redirect_uri mismatch');
    if (claims.cid && clientId && claims.cid !== clientId)
      return err('invalid_grant', 'client_id mismatch');
    if (!claims.cc || !verifier) return err('invalid_grant', 'missing PKCE');
    const challenge = await pkceS256(verifier);
    if (challenge !== claims.cc) return err('invalid_grant', 'PKCE verification failed');
    return issueTokens(claims.scope || 'mcp', now(), secret);
  }

  if (grant === 'refresh_token') {
    const rt = form.get('refresh_token');
    const claims = await verify(rt, secret);
    if (!claims || claims.typ !== 'refresh' || claims.kv !== tokenVersion())
      return err('invalid_grant', 'bad refresh token');
    if (typeof claims.at !== 'number' || now() - claims.at >= MAX_SESSION)
      return err('invalid_grant', 'session expired');
    return issueTokens(claims.scope || 'mcp', claims.at, secret);
  }

  return err('unsupported_grant_type', String(grant || ''));
}
