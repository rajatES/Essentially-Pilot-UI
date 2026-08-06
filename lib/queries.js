"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, getToken } from "@/lib/apiClient";

// Shared server-data hooks. All views read the same ["posts"] cache
// (accounts + posts + authors from GET /api/posts); mutations call
// usePostsInvalidate() instead of the old loadData() prop-drilling.

// Poll interval for the data that changes without anyone touching this browser.
// The publish cron runs every 5 minutes, so a minute is comfortably responsive
// while staying ~5x cheaper than a 12s poll. Two things keep this from being a
// load problem: React Query dedupes by key, so the shell + Posts + Calendar all
// mounted at once still issue ONE request; and refetchIntervalInBackground
// defaults to false, so a tab left open in the background polls nothing at all.
const LIVE_POLL_MS = 60_000;

export function usePostsData() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: () => apiJson("/api/posts"),
    enabled: typeof window !== "undefined" && !!getToken(),
    // Statuses move on their own — cron publishes, platforms report deletions —
    // so refresh in the background instead of waiting for a manual Refresh.
    refetchInterval: LIVE_POLL_MS,
  });
}

export function usePostsInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["posts"] });
}

// Editable sports/vertical taxonomy (GET /api/sports). Powers the account
// category dropdowns; the list is seeded server-side on first read.
export function useSports() {
  return useQuery({
    queryKey: ["sports"],
    queryFn: () => apiJson("/api/sports"),
    enabled: typeof window !== "undefined" && !!getToken(),
    // Taxonomy, not live data — an admin edits it rarely. Without a longer
    // window the app-wide focus refetch would re-pull it every 30s of
    // tab-switching for no reason. Editing it invalidates the key directly.
    staleTime: 10 * 60 * 1000,
  });
}

// Per-post performance rollup (GET /api/insights?days=N). Metrics come from the
// platform APIs by post id — no scraper.
export function useInsights(days = 30) {
  return useQuery({
    queryKey: ["insights", days],
    queryFn: () => apiJson(`/api/insights?days=${days}`),
    enabled: typeof window !== "undefined" && !!getToken(),
  });
}

// API Activity (GET /api/api-keys/activity) — posts created via the Developer
// API + per-key usage rollups. Admin-only endpoint; the nav entry that mounts
// this is admin-gated, so non-admins never call it.
export function useApiActivity({ keyId = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (keyId) params.set("keyId", keyId);
  if (status) params.set("status", status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["api-activity", keyId, status],
    queryFn: () => apiJson(`/api/api-keys/activity${qs ? `?${qs}` : ""}`),
    enabled: typeof window !== "undefined" && !!getToken(),
  });
}

// Detailed Post Analytics rows (GET /api/insights/posts) — one row per
// post×page with content details + every metric, for the Post Analytics table.
export function usePostAnalytics({ days, start, end } = {}) {
  const params = new URLSearchParams();
  if (start && end) { params.set("start", start); params.set("end", end); }
  else params.set("days", String(days || 30));
  const qs = params.toString();
  return useQuery({
    queryKey: ["post-analytics", start && end ? `${start}:${end}` : `days:${days || 30}`],
    queryFn: () => apiJson(`/api/insights/posts?${qs}`),
    enabled: typeof window !== "undefined" && !!getToken(),
    // Cached rows render instantly, but always refetch on mount/focus so posts
    // published or synced since the last visit appear without a manual Refresh
    // (the endpoint is a cheap DB read — no live platform calls).
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

// Page-grouped pending-approval queue (GET /api/approvals/pending) — one item
// per post × page awaiting review, with a per-viewer canReview flag.
export function usePendingApprovals() {
  return useQuery({
    queryKey: ["approvals-pending"],
    queryFn: () => apiJson("/api/approvals/pending"),
    enabled: typeof window !== "undefined" && !!getToken(),
    staleTime: 15 * 1000,
    refetchOnMount: "always",
    // Drives the sidebar badge, which is only useful if it reflects what other
    // reviewers and the API have submitted since the page loaded.
    refetchInterval: LIVE_POLL_MS,
  });
}

// Design Template library (GET /api/design-templates) — reusable image-gen prompts.
export function useDesignTemplates() {
  return useQuery({
    queryKey: ["design-templates"],
    queryFn: () => apiJson("/api/design-templates"),
    enabled: typeof window !== "undefined" && !!getToken(),
    // Same reasoning as useSports — a curated library, not live data.
    staleTime: 10 * 60 * 1000,
  });
}

// Optimistically edit the cached posts array so the UI updates instantly,
// before the server responds. Returns a rollback() that restores the previous
// cache — call it if the request fails. `updater(posts)` returns the new array.
export function useOptimisticPosts() {
  const qc = useQueryClient();
  return (updater) => {
    const prev = qc.getQueryData(["posts"]);
    if (prev?.posts) {
      qc.setQueryData(["posts"], { ...prev, posts: updater(prev.posts) });
    }
    return () => { if (prev) qc.setQueryData(["posts"], prev); };
  };
}
