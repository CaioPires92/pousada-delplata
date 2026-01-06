import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Set explicit workspace root to silence warnings
  outputFileTracingRoot: path.join(__dirname, '..'),

  // Image optimization
  images: {
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
