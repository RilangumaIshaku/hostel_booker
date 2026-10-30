import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-app browser reaches the local dev server through this private host.
  allowedDevOrigins: ["172.30.96.1"],
};

export default nextConfig;
