import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/**/*.test.ts"],
    environmentMatchGlobs: [
      ["client/src/**/*.test.ts", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["server/**/*.ts", "client/src/lib/**/*.ts", "client/src/i18n/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "server/_core/**",
        "server/test/**",
        "server/routers/**",
        "server/seedCosmetics.ts",
        "server/valorant.ts",
        "server/index.ts",
        "client/src/lib/trpc.ts",
        "drizzle/**",
      ],
    },
  },
});
