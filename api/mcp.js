export const config = { runtime: 'edge' };
import { verify } from '../lib/token.js';
import { getBaseUrl, cors } from '../lib/base.js';

const GITHUB_MCP = 'https://api.githubcopilot.com/mcp/';

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  const secret = process.env.SIGNING_SECRET;
  const pat = process.env.GITHUB_PAT;
  const base = getBaseUrl(request);

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const claims = token ? await verify(token, secret) : null;

  if (!claims || claims.typ !== 'access') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        ...cors()
      }
    });
  }

  // Forward the request to the official GitHub MCP server, swapping our
  // bearer for the GitHub PAT.
  const fwdHeaders = new Headers();
  fwdHeaders.set('authorization', `Bearer ${pat}`);
  for (const h of ['accept', 'content-type', 'mcp-protocol-version', 'mcp-session-id']) {
    const v = request.headers.get(h);
    if (v) fwdHeaders.set(h, v);
  }

  const init = { method: request.method, headers: fwdHeaders };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(GITHUB_MCP, init);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream_unreachable', detail: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...cors() }
    });
  }

  const respHeaders = new Headers(cors());
  for (const h of ['content-type', 'mcp-session-id']) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  respHeaders.set('cache-control', 'no-store');

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}
