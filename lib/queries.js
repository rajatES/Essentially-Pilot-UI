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
