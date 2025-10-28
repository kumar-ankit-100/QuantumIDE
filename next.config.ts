import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // Suppress font preload warnings
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
