/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["grant-scout"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
