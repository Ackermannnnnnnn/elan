import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // PGlite démarre un PostgreSQL complet : on laisse de la marge au premier lancement.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
