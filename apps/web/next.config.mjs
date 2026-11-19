/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@orbit/types'],
  async rewrites() {
    // 127.0.0.1, not localhost: Node 17+ resolves localhost to ::1 first, and the API listens on IPv4 only.
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
