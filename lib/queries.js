"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, getToken } from "@/lib/apiClient";

// Shared server-data hooks. All views read the same ["posts"] cache
// (accounts + posts + authors from GET /api/posts); mutations call
// usePostsInvalidate() instead of the old loadData() prop-drilling.

export function usePostsData() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: () => apiJson("/api/posts"),
    enabled: typeof window !== "undefined" && !!getToken(),
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
