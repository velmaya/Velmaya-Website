import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product images are served from Cloudflare R2's public URL, not Next's
    // built-in image optimizer (which isn't available on Cloudflare's Workers runtime).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
