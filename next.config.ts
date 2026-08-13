import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent-directory package-lock.json confuses Turbopack root inference.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
