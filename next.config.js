/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverComponentsExternalPackages: ["mysql2"],
  },
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

module.exports = nextConfig;
