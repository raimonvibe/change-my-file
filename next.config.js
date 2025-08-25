/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    unoptimized: true,
  },

  experimental: {
    // Alleen nodig als je RSC gebruikt en externe packages wilt toelaten
    serverComponentsExternalPackages: ['mongodb'],
  },

  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },

  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Let op: 'ALLOWALL' is géén geldige X-Frame-Options waarde.
          // Gebruik de CSP 'frame-ancestors' (staat hieronder) als truth.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },

          // Je staat alles toe met '*'; dat is heel open. Pas aan indien nodig.
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },

          // Let op: '*' werkt niet in combinatie met credentials/cookies.
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ORIGINS || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
