export const ENV = {
  appId: process.env.VITE_APP_ID ?? "lol-tracker",
  cookieSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  databasePath: process.env.DATABASE_PATH ?? "./data/lol-tracker.db",
  isProduction: process.env.NODE_ENV === "production",
  // Optional: OpenAI-compatible API for AI meme news generation
  // Set OPENAI_API_URL and OPENAI_API_KEY to enable AI-generated news
  // Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
  openaiApiUrl: process.env.OPENAI_API_URL || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  // Riot Games API
  riotApiKey: process.env.RIOT_API_KEY ?? "",
  // CORS: set to frontend URL when hosting frontend separately (e.g., behind a reverse proxy)
  // Leave empty for same-origin deployment
  corsOrigin: process.env.CORS_ORIGIN ?? "",
};
