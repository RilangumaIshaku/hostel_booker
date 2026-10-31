import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-app browser reaches the local dev server through these hosts.
  allowedDevOrigins: ["172.30.96.1", "127.0.0.1", "localhost"],
};

export default nextConfig;
