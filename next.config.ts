import type { NextConfig } from "next";

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.googletagmanager.com https://www.google-analytics.com https://*.clarity.ms https://*.mercadopago.com https://*.mercadolibre.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.mercadopago.com https://*.mercadolibre.com https://images.unsplash.com https://picsum.photos;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com;
    connect-src 'self' https://*.mercadopago.com https://*.mercadolibre.com https://www.google-analytics.com https://*.clarity.ms https://*.sentry.io;
    block-all-mixed-content;
    upgrade-insecure-requests;
`.replace(/\n/g, "").replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://www.google-analytics.com https://www.googletagmanager.com https://*.clarity.ms https://*.sentry.io",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' https://fonts.gstatic.com",
                "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
                "connect-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://www.google-analytics.com https://*.clarity.ms https://*.sentry.io"
            ].join('; ')
        },
      },
    ];
  },
  /* config options here */
  // App now lives at repository root; keep tracing within this directory
  outputFileTracingRoot: __dirname,

  // Image optimization
  images: {
    qualities: [72, 74, 75, 76, 82, 84],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },


  // Server-side packages that should not be bundled
  serverExternalPackages: [
    '@libsql/client',
    'libsql',
    '@prisma/adapter-libsql',
  ],

  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    rules: {
      // Ignore LICENSE and other text files
      '*.{md,txt,LICENSE}': {
        loaders: ['raw-loader'],
      },
    },
  },

  // Webpack config for backward compatibility and when using --webpack flag
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark libsql and related packages as external to avoid bundling issues
      config.externals = config.externals || [];
      config.externals.push('@libsql/client', 'libsql', '@prisma/adapter-libsql');
    }
    return config;
  },
};

export default nextConfig;
