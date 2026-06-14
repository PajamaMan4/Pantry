import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native (binary) module. Keep it out of the bundler so
  // Next.js requires it directly at runtime on the server instead of trying to
  // bundle the .node binding. See §1.2 / §4.x of the technical design.
  serverExternalPackages: ["better-sqlite3"],
  // Allow the dev server to be reached from other devices on the LAN (e.g.
  // testing on a phone) — otherwise Next.js blocks cross-origin requests to
  // /_next/* assets, so the page renders but client JS never hydrates.
  allowedDevOrigins: ["192.168.86.248"],
};

export default nextConfig;
