import "dotenv/config";

// Global error handlers — prevent silent crashes
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
});
import express from "express";
// cors handled manually below
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startPolling } from "../pollEngine";
import { ensureBotUser } from "../botTrader";
import { startDiscordBot } from "../discordBot";
import { ENV } from "./env";

// Programmatic migration — runs at app startup, after volumes are mounted
async function runMigrations() {
  try {
    console.log("[DB] Running migrations...");
    console.log("[DB] Database path:", ENV.databasePath);

    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    const { existsSync, mkdirSync } = await import("fs");
    const { dirname } = await import("path");

    // Ensure the data directory exists
    const dir = dirname(ENV.databasePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`[DB] Created directory: ${dir}`);
    }

    const client = createClient({ url: `file:${ENV.databasePath}` });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[DB] ✓ Migrations completed successfully");
  } catch (error) {
    console.error("[DB] ✗ Migration failed:", error);
    // Don't throw — the app may still work if tables already exist
    console.log("[DB] Continuing startup despite migration error...");
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Startup Diagnostics ──────────────────────────────────────────────────
  console.log("[Server] ─── Backend Startup Diagnostics ───");
  console.log("[Server] NODE_ENV:", process.env.NODE_ENV || "(not set)");
  console.log("[Server] DATABASE_PATH:", ENV.databasePath);
  console.log("[Server] CORS_ORIGIN:", ENV.corsOrigin || "(not set — same-origin mode)");
  console.log("[Server] RIOT_API_KEY:", ENV.riotApiKey ? `${ENV.riotApiKey.slice(0, 8)}...` : "(not set)");
  console.log("[Server] JWT_SECRET:", ENV.cookieSecret === "change-me-in-production" ? "⚠️ USING DEFAULT (insecure)" : "✓ Custom secret set");
  console.log("[Server] OPENAI_API_URL:", ENV.openaiApiUrl || "(not set — AI news disabled)");
  console.log("[Server] Mode:", ENV.corsOrigin ? "SPLIT (backend only, frontend served separately)" : "SAME-ORIGIN (full stack)");
  console.log("[Server] ───────────────────────────────────────");

  // ─── Block startup with insecure JWT secret in production ─────────────────
  if (ENV.isProduction && ENV.cookieSecret === "change-me-in-production") {
    console.error("[Server] FATAL: JWT_SECRET must be set in production. Using the default secret allows token forgery. Exiting.");
    process.exit(1);
  }

  // ─── Run migrations before anything else ──────────────────────────────────
  await runMigrations();

  // ─── Request logging middleware ───────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    const origin = req.headers.origin || "(no origin)";
    const hasCookies = !!req.headers.cookie;
    const cookieNames = hasCookies
      ? req.headers.cookie!.split(";").map(c => c.trim().split("=")[0]).join(", ")
      : "(none)";

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const path = req.path;

      const statusTag = status >= 500 ? "✗" : status >= 400 ? "⚠" : "✓";

      if (path.startsWith("/api/")) {
        console.log(
          `[HTTP] ${statusTag} ${method} ${path} → ${status} (${duration}ms) | origin: ${origin} | cookies: [${cookieNames}]`
        );

        if (origin !== "(no origin)" && ENV.corsOrigin) {
          const isAllowed = origin === ENV.corsOrigin;
          if (!isAllowed) {
            console.warn(`[CORS] ⚠️ Origin "${origin}" does NOT match CORS_ORIGIN="${ENV.corsOrigin}"`);
          }
        }

        if (path.startsWith("/api/trpc")) {
          if (!hasCookies) {
            console.log(`[Auth] No cookies sent with request — user is not authenticated`);
          } else if (!req.headers.cookie?.includes("app_session_id")) {
            console.log(`[Auth] Cookies present but no session cookie (app_session_id) — user is not authenticated`);
          }
        }
      }
    });

    next();
  });

  // ─── CORS Configuration ───────────────────────────────────────────────────
  if (ENV.corsOrigin) {
    // Explicit preflight handler — runs FIRST, before any other middleware
    // This ensures OPTIONS requests always get correct CORS headers
    app.options("*", (req, res) => {
      const origin = req.headers.origin;
      console.log(`[CORS] Preflight OPTIONS from: ${origin || "(no origin)"}`);
      if (origin === ENV.corsOrigin) {
        res.setHeader("Access-Control-Allow-Origin", ENV.corsOrigin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight for 24h
        res.status(204).end();
      } else {
        console.warn(`[CORS] ⚠️ Preflight BLOCKED from: ${origin}`);
        res.status(403).end();
      }
    });

    // CORS middleware for all other requests
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin === ENV.corsOrigin) {
        res.setHeader("Access-Control-Allow-Origin", ENV.corsOrigin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else if (origin) {
        console.error(`[CORS] ✗ BLOCKED request from origin: "${origin}" (allowed: "${ENV.corsOrigin}")`);
      }
      next();
    });
    console.log(`[CORS] Enabled for origin: ${ENV.corsOrigin}`);
  } else {
    console.log("[CORS] Disabled (same-origin mode)");
  }

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // In split deployment mode, don't serve static files
  if (!ENV.corsOrigin) {
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Initialize bot user before starting polling
    try {
      const botId = await ensureBotUser();
      console.log(`[Server] QuantBot initialized (userId: ${botId})`);
    } catch (err) {
      console.error("[Server] Failed to initialize QuantBot:", err);
    }
    // Seed cosmetics catalog
    try {
      const { seedCosmeticsIfEmpty } = await import("../seedCosmetics");
      await seedCosmeticsIfEmpty();
    } catch (err) {
      console.error("[Server] Failed to seed cosmetics:", err);
    }
    // Restore persisted casino game states
    try {
      const { restoreBlackjackGames } = await import("../blackjack");
      const { restoreMinesGames } = await import("../mines");
      const { restoreCrashGames } = await import("../crash");
      const { restoreVideoPokerGames } = await import("../videoPoker");
      const { restoreHiloGames } = await import("../hilo");
      const counts = await Promise.all([
        restoreBlackjackGames(), restoreMinesGames(), restoreCrashGames(),
        restoreVideoPokerGames(), restoreHiloGames(),
      ]);
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (total > 0) console.log(`[Server] Restored ${total} active casino games from DB`);
    } catch (err) {
      console.error("[Server] Failed to restore casino games:", err);
    }
    startPolling();
    // Start Discord interactive bot (Gateway connection)
    startDiscordBot().catch(err => {
      console.error("[Server] Failed to start Discord bot:", err);
    });
  });
}

startServer().catch(console.error);
