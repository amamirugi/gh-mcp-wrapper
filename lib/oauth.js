// Shared OAuth policy: redirect URI allowlist, token versioning, safe compare.

const DEFAULT_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback'
];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function configuredRedirectUris() {
  const raw = process.env.ALLOWED_REDIRECT_URIS;
  if (!raw) return DEFAULT_REDIRECT_URIS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Exact match against the allowlist, or an http loopback URI (RFC 8252 §7.3)
// for native clients such as Claude Code.
export function isAllowedRedirectUri(value) {
  if (!value || typeof value !== 'string') return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return true;
  return configuredRedirectUris().includes(value);
}

// Bump TOKEN_VERSION in the environment to invalidate every issued token.
export function tokenVersion() {
  return process.env.TOKEN_VERSION || '1';
}

async function sha256(value) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value ?? '')))
  );
}

export async function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
