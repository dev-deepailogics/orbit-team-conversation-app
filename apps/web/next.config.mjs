/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@orbit/types'],
  async headers() {
    // Baseline security headers for every page. Camera, microphone and screen capture are allowed for the app itself
    // (huddles and recordings); everything else is off.
    return [
      {
        source: '/:path*',
        headers: [
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
