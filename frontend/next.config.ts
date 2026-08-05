import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

// The repo root has its own lockfile (Tauri CLI tooling), so Next.js cannot
// infer the app root. Point Turbopack at the frontend directory explicitly.
const appRoot =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // GuideForge is a desktop app: no server needed. Next.js emits a static
  // export into `out/` which the Tauri shell serves from the webview.
  output: "export",
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
