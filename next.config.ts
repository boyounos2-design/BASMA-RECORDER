import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/BASMA-RECORDER',
  assetPrefix: '/BASMA-RECORDER/',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
