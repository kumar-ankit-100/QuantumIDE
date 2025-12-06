import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  
  // Server-only packages (moved from experimental in Next.js 15)
  serverExternalPackages: ['dockerode', 'ssh2', 'docker-modem'],
  
  // Fix for file watcher limit issues - use webpack instead of turbopack
  // Turbopack is experimental and can cause file watcher issues on Linux
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Disable turbopack to avoid file watcher issues
    turbo: undefined,
  },
  
  // Build optimizations
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Optimize webpack to reduce file watching
  webpack: (config, { dev, isServer }) => {
    // Ignore .node files in client bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      // Ignore native modules completely on client
      config.externals = config.externals || [];
      config.externals.push({
        'dockerode': 'commonjs dockerode',
        'ssh2': 'commonjs ssh2',
        'docker-modem': 'commonjs docker-modem',
      });
    }

    if (dev && !isServer) {
      // Reduce file watching in development
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/projects/**', // Ignore docker project folders
        ],
      };
    }
    
    return config;
  },
};

export default nextConfig;
