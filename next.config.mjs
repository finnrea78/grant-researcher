/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    serverComponentsExternalPackages: ["pdfjs-dist", "mammoth", "@anthropic-ai/claude-agent-sdk"],
  },
};

export default nextConfig;
