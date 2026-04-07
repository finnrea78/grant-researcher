/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    serverComponentsExternalPackages: ["pdfjs-dist", "mammoth"],
  },
};

export default nextConfig;
