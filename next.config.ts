import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack for faster development
  // Turbopack is default in Next.js 16, but let's be explicit
  
  // Optimize production builds
  reactStrictMode: false, // Disable double-rendering in dev
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Reduce console noise in dev
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // Experimental optimizations
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
};

export default nextConfig;
