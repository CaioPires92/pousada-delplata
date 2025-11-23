import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  // Keep webpack config for backward compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark libsql and related packages as external to avoid bundling issues
      config.externals = config.externals || [];
      config.externals.push('@libsql/client', 'libsql');
    }
    return config;
  },
  serverExternalPackages: ['@libsql/client', 'libsql'],
};

export default nextConfig;
