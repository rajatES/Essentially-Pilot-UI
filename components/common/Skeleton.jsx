"use client";

// Shared loading skeletons — pulsing placeholders shown on first load instead
// of a bare "Loading…" so the layout appears instantly and doesn't jump.

export function SkeletonBar({ className = "" }) {
  return <div className={`animate-pulse rounded bg-slate-100 dark:bg-gray-800 ${className}`} />;
}

// A post-card-shaped placeholder for the Posts list.
export function PostCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <SkeletonBar className="h-5 w-16" />
        <SkeletonBar className="h-5 w-28" />
        <SkeletonBar className="h-5 w-20" />
      </div>
      <SkeletonBar className="mb-1.5 h-3 w-full" />
      <SkeletonBar className="mb-1.5 h-3 w-11/12" />
      <SkeletonBar className="h-3 w-2/3" />
    </div>
  );
}

export function PostListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <PostCardSkeleton key={i} />)}
    </div>
  );
}
