import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native (binary) module. Keep it out of the bundler so
  // Next.js requires it directly at runtime on the server instead of trying to
  // bundle the .node binding. See §1.2 / §4.x of the technical design.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
