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
// These logs appear in the browser console (Vercel → Inspect → Functions or
// browser DevTools → Console). They help diagnose frontend ↔ backend issues.

const API_BASE = import.meta.env.VITE_API_URL || "";
const TRPC_URL = `${API_BASE}/api/trpc`;

console.log("[Config] ─── Frontend Connection Diagnostics ───");
console.log("[Config] VITE_API_URL:", import.meta.env.VITE_API_URL || "(not set — same-origin mode)");
console.log("[Config] tRPC endpoint:", TRPC_URL);
console.log("[Config] Current origin:", window.location.origin);
console.log("[Config] Mode:", API_BASE ? "SPLIT (Vercel→Railway)" : "SAME-ORIGIN (single process)");
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
    // Detailed error logging for connection diagnosis
    if (error instanceof TRPCClientError) {
      console.error("[API Query Error]", {
        message: error.message,
        path: (event.query.queryKey as any)?.[0]?.join?.(".") || "unknown",
        data: error.data,
        shape: error.shape,
      });
      // Check for network/CORS errors
      if (error.message === "Failed to fetch" || error.message.includes("NetworkError")) {
        console.error("[CORS/Network] ⚠️ Request failed — likely a CORS or network issue.");
        console.error("[CORS/Network] Check that CORS_ORIGIN on your backend matches:", window.location.origin);
        console.error("[CORS/Network] Backend URL:", TRPC_URL);
      }
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
      if (error.message === "Failed to fetch" || error.message.includes("NetworkError")) {
        console.error("[CORS/Network] ⚠️ Mutation failed — likely a CORS or network issue.");
        console.error("[CORS/Network] Check that CORS_ORIGIN on your backend matches:", window.location.origin);
      }
    } else {
      console.error("[API Mutation Error]", error);
    }
  }
});

// ─── tRPC Client with request/response logging ─────────────────────────────

let requestCounter = 0;

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      transformer: superjson,
      fetch(input, init) {
        const reqId = ++requestCounter;
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const shortUrl = url.replace(TRPC_URL, "");
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
          } else if (status === 0 || !response.ok) {
            console.error(`[tRPC #${reqId}] ← ${status} FAILED (${duration}ms) ${shortUrl}`);
            if (status === 0) {
              console.error(`[tRPC #${reqId}] ⚠️ Status 0 = CORS blocked or network error`);
              console.error(`[tRPC #${reqId}] Verify CORS_ORIGIN="${window.location.origin}" is set on backend`);
            }
          } else {
            console.warn(`[tRPC #${reqId}] ← ${status} (${duration}ms) ${shortUrl}`);
          }

          // Log cookie presence (helps debug auth issues)
          const setCookie = response.headers.get("set-cookie");
          if (setCookie) {
            console.log(`[tRPC #${reqId}] 🍪 Set-Cookie header received`);
          }

          return response;
        }).catch(err => {
          const duration = (performance.now() - start).toFixed(0);
          console.error(`[tRPC #${reqId}] ✗ NETWORK ERROR (${duration}ms) ${shortUrl}`);
          console.error(`[tRPC #${reqId}] Error:`, err.message);
          if (err.message === "Failed to fetch") {
            console.error(`[tRPC #${reqId}] ─── CORS Diagnosis ───`);
            console.error(`[tRPC #${reqId}] Frontend origin: ${window.location.origin}`);
            console.error(`[tRPC #${reqId}] Backend URL: ${TRPC_URL}`);
            console.error(`[tRPC #${reqId}] This usually means:`);
            console.error(`[tRPC #${reqId}]   1. Backend is down or unreachable`);
            console.error(`[tRPC #${reqId}]   2. CORS_ORIGIN on backend doesn't match "${window.location.origin}"`);
            console.error(`[tRPC #${reqId}]   3. Backend URL is wrong (check VITE_API_URL)`);
            console.error(`[tRPC #${reqId}] ──────────────────────`);
          }
          throw err;
        });
      },
    }),
  ],
});

// ─── Health check on startup ────────────────────────────────────────────────
// Quick fetch to /api/health to verify backend connectivity
if (API_BASE) {
  fetch(`${API_BASE}/api/health`, { mode: "cors" })
    .then(res => {
      if (res.ok) {
        console.log("[Health] ✓ Backend reachable at", API_BASE);
        return res.json().then(data => console.log("[Health] Response:", data));
      } else {
        console.error("[Health] ✗ Backend returned", res.status, res.statusText);
      }
    })
    .catch(err => {
      console.error("[Health] ✗ Cannot reach backend at", API_BASE);
      console.error("[Health] Error:", err.message);
      if (err.message === "Failed to fetch") {
        console.error("[Health] ─── This means the backend is either down or CORS is blocking ───");
      }
    });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
