import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/glassbox',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
