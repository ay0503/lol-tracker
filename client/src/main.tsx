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
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// When VITE_API_URL is set, the frontend talks to a separate backend (e.g., Railway)
// Otherwise, it uses the same origin (single-process deployment)
const API_BASE = import.meta.env.VITE_API_URL || "";

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
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
