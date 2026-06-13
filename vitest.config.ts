import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest is for the framework-agnostic domain layer (§4.4) — pure functions in
// src/lib/domain. The `@/` alias mirrors tsconfig so tests can import like the app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
