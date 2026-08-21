import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent-directory package-lock.json confuses Turbopack root inference.
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/setting",
        destination: "/dashboard/settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
