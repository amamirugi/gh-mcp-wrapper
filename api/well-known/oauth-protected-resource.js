export const config = { runtime: 'edge' };
import { getBaseUrl, cors } from '../../lib/base.js';

export default async function handler(request) {
  const base = getBaseUrl(request);
  return Response.json(
    {
      resource: `${base}/mcp`,
      authorization_servers: [base],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header']
    },
    { headers: cors() }
  );
}
