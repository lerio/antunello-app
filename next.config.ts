import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  // Bundle optimization
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-select'],
  },
  // Explicitly set tracing root to this project to avoid incorrect workspace inference
  outputFileTracingRoot: __dirname,

  // Suppress Supabase Edge Runtime warnings and try cache optimization
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Align optimization with JS config
    config.optimization = config.optimization || {};
    config.optimization.moduleIds = 'deterministic';

    // (Removed cache tuning assertions to simplify config and avoid unnecessary type assertions)

    // Try disabling filesystem cache in development to avoid the warning
    if (dev) {
      config.cache = false;
    }

    config.ignoreWarnings = [
      { module: /node_modules\/@supabase\/realtime-js/ },
      { module: /node_modules\/@supabase\/supabase-js/ },
      /Critical dependency: the request of a dependency is an expression/,
      // Suppress the serialization warning as a last resort
      /Serializing big strings.*impacts deserialization performance/,
    ];

    return config;
  },

  // Performance optimizations
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
