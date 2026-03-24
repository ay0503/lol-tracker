import { defineConfig } from "drizzle-kit";

const dbPath = process.env.DATABASE_PATH || "./data/lol-tracker.db";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
