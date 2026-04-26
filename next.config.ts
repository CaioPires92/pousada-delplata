import type { NextConfig } from "next";

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
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://*.google-analytics.com https://*.googletagmanager.com https://*.google.com https://*.doubleclick.net https://*.clarity.ms https://*.sentry.io",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' https://fonts.gstatic.com",
                "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
                "connect-src 'self' https://*.mercadopago.com https://*.mlstatic.com https://*.mercadolibre.com https://*.google-analytics.com https://*.google.com https://*.doubleclick.net https://*.clarity.ms https://*.sentry.io"
            ].join('; ')
          },
        ],
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
    '@prisma/client',
    '@prisma/instrumentation',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/instrumentation',
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
      config.externals.push(
        '@libsql/client', 
        'libsql', 
        '@prisma/adapter-libsql',
        '@prisma/client',
        '@prisma/instrumentation',
        '@opentelemetry/api',
        '@opentelemetry/sdk-node',
        '@opentelemetry/instrumentation'
      );
    }

    // Suppress the "Critical dependency: the request of a dependency is an expression" warning
    // from OpenTelemetry and Prisma instrumentation
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push(
      { module: /node_modules\/@opentelemetry\/instrumentation/ },
      { module: /node_modules\/@prisma\/instrumentation/ }
    );

    return config;
  },
};

export default nextConfig;
