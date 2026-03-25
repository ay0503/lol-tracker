import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { LanguageProvider } from "./contexts/LanguageContext";
import "./index.css";

// ─── Connection Diagnostics ─────────────────────────────────────────────────
// In split deployment (Vercel + Railway), Vercel rewrites proxy /api/* to Railway.
// The browser always sees same-origin requests — no CORS needed.

const TRPC_URL = "/api/trpc";

console.log("[Config] ─── Frontend Connection Diagnostics ───");
console.log("[Config] tRPC endpoint:", TRPC_URL);
console.log("[Config] Current origin:", window.location.origin);
console.log("[Config] Mode: Vercel proxy (same-origin via rewrites)");
console.log("[Config] Cookies enabled:", navigator.cookieEnabled);
console.log("[Config] ─────────────────────────────────────────");

/**
 * Client-side caching strategy:
 * - staleTime: 10 min → data is considered "fresh" for 10 min after fetch, no refetch on mount
 * - gcTime: 30 min → cached data stays in memory for 30 min even after components unmount
 * - refetchOnWindowFocus: false → don't refetch when user switches tabs back
 * - refetchOnReconnect: true → refetch if network reconnects (default)
 *
 * The server-side cache (30 min TTL) is the primary cache layer.
 * The client-side cache prevents redundant network requests during navigation.
 */
const STALE_TIME = 10 * 60 * 1000; // 10 minutes
const GC_TIME = 30 * 60 * 1000;    // 30 minutes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Don't redirect if already on login or register page
  const path = window.location.pathname;
  if (path === "/login" || path === "/register") return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    if (error instanceof TRPCClientError) {
      console.error("[API Query Error]", {
        message: error.message,
        path: (event.query.queryKey as any)?.[0]?.join?.(".") || "unknown",
        data: error.data,
        shape: error.shape,
      });
    } else {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    if (error instanceof TRPCClientError) {
      console.error("[API Mutation Error]", {
        message: error.message,
        data: error.data,
        shape: error.shape,
      });
    } else {
      console.error("[API Mutation Error]", error);
    }
  }
});

// ─── tRPC Client ──────────────────────────────────────────────────────────────

let requestCounter = 0;

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      transformer: superjson,
      fetch(input, init) {
        const reqId = ++requestCounter;
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const shortUrl = url.replace(window.location.origin, "");
        console.log(`[tRPC #${reqId}] → ${shortUrl}`);
        const start = performance.now();

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then(response => {
          const duration = (performance.now() - start).toFixed(0);
          const status = response.status;

          if (status >= 200 && status < 300) {
            console.log(`[tRPC #${reqId}] ← ${status} OK (${duration}ms) ${shortUrl}`);
          } else {
            console.warn(`[tRPC #${reqId}] ← ${status} (${duration}ms) ${shortUrl}`);
          }

          return response;
        }).catch(err => {
          const duration = (performance.now() - start).toFixed(0);
          console.error(`[tRPC #${reqId}] ✗ ERROR (${duration}ms) ${shortUrl}`, err.message);
          throw err;
        });
      },
    }),
  ],
});

// ─── Health check on startup ────────────────────────────────────────────────
fetch("/api/health")
  .then(res => {
    if (res.ok) {
      console.log("[Health] ✓ Backend reachable via Vercel proxy");
      return res.json().then(data => console.log("[Health] Response:", data));
    } else {
      console.error("[Health] ✗ Backend returned", res.status, res.statusText);
    }
  })
  .catch(err => {
    console.error("[Health] ✗ Cannot reach backend:", err.message);
  });

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
