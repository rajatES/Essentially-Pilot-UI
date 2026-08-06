"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// App-wide data layer: caching, background refetch, retry, optimistic updates.
export function Providers({ children }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data older than this is refetched when the tab regains focus.
            // Posts change outside this browser — the publish cron sends them,
            // reviewers approve them, platforms report deletions — so coming
            // back to a tab used to show a stale board until someone hit
            // Refresh. staleTime keeps this cheap: flicking between tabs
            // inside 30s costs nothing, and a refetch keeps the previous data
            // on screen while it runs, so nothing flickers.
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: true
          }
        }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
