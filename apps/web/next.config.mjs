const isDev = process.env.NODE_ENV !== 'production';

/** `scheme://host[:port]` of a URL, or null when it's missing or invalid. */
function originOf(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const SCHEME_TWIN = { 'https:': 'wss:', 'http:': 'ws:', 'wss:': 'https:', 'ws:': 'http:' };

/** The origin plus the same host in its paired scheme (http <-> ws, https <-> wss), so REST and WebSocket both match. */
function withSocketTwin(origin) {
  if (!origin) return [];
  const { protocol, host } = new URL(origin);
  return SCHEME_TWIN[protocol] ? [origin, `${SCHEME_TWIN[protocol]}//${host}`] : [origin];
}

/**
 * Content-Security-Policy for the web app (DAST-003).
 *
 * Built at `next build` time (Next bakes headers into the build), from:
 *   NEXT_PUBLIC_SERVER_URL  - API + Socket.IO + file links (defaults to the same origin)
 *   NEXT_PUBLIC_LIVEKIT_URL - call server; when it isn't known at build time any secure WebSocket (wss:) is allowed so
 *                             calls never break on an environment that hosts LiveKit elsewhere
 *   CSP_EXTRA_CONNECT_SRC   - optional, space-separated extra origins
 *
 * Scripts: only our own; inline is required because Next.js and the theme bootstrap in app/layout.tsx use inline
 * scripts (no nonce support without making every page dynamic). External scripts, plugins, <base> tricks, foreign form
 * targets and framing by other sites are all blocked.
 */
function contentSecurityPolicy() {
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_SERVER_URL) ?? (isDev ? 'http://localhost:4000' : null);
  const api = apiOrigin ? [apiOrigin] : [];
  const livekitOrigin = originOf(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const livekit = livekitOrigin ? withSocketTwin(livekitOrigin) : ['wss:'];
  const extra = (process.env.CSP_EXTRA_CONNECT_SRC || '').split(/\s+/).filter(Boolean);
  const devOnly = isDev ? ['ws://localhost:*', 'http://localhost:*'] : []; // Next dev server hot reload + local services

  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    // Avatars and images in messages can come from any HTTPS site.
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...api, ...devOnly],
    'media-src': ["'self'", 'blob:', ...api, ...devOnly],
    'connect-src': ["'self'", ...withSocketTwin(apiOrigin), ...livekit, ...extra, ...devOnly],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...api],
    'frame-ancestors': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${[...new Set(values)].join(' ')}`)
    .join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework (DAST-007).
  poweredByHeader: false,
  transpilePackages: ['@orbit/types'],
  async headers() {
    // Baseline security headers for every page. Camera, microphone and screen capture are allowed for the app itself
    // (huddles and recordings); everything else is off.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  async rewrites() {
    // Use 127.0.0.1 rather than localhost: on machines where localhost resolves
    // to ::1 first, Node's rewrite fetch doesn't fall back to IPv4 and the
    // backend (IPv4-only) becomes unreachable, surfacing as a 500 on every /api call.
    const serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.SERVER_URL ||
      'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
