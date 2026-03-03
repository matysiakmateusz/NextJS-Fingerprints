import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_VERCEL: process.env.VERCEL ?? "",
  },
};

export default nextConfig;
