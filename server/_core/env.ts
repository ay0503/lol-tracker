export const ENV = {
  appId: process.env.VITE_APP_ID ?? "lol-tracker",
  cookieSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  databasePath: process.env.DATABASE_PATH ?? "./data/lol-tracker.db",
  isProduction: process.env.NODE_ENV === "production",
  // Optional: OpenAI-compatible API for AI meme news generation
  // Falls back to BUILT_IN_FORGE_API if OPENAI vars are not set
  openaiApiUrl: process.env.OPENAI_API_URL || process.env.BUILT_IN_FORGE_API_URL || "",
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "",
  // Riot Games API
  riotApiKey: process.env.RIOT_API_KEY ?? "",
  // CORS: set to frontend URL when hosting frontend separately (e.g., Vercel)
  // Leave empty for same-origin deployment
  corsOrigin: process.env.CORS_ORIGIN ?? "",
};
