"use client";

import { useMemo, useState } from "react";
import { FileText, LayoutList, Search, Users, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { PLATFORM_META } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsData, usePostsInvalidate, useOptimisticPosts, usePostFailures } from "@/lib/queries";
import PostCard from "./PostCard";
import FailureList from "./FailureList";
import CsvImportModal from "./CsvImportModal";
import { PostListSkeleton } from "@/components/common/Skeleton";

// SocialPilot-style Manage Posts: status tabs + combined filters.
//
// `match` rather than a status list so a tab can be more than a post status.
// **Error is the exception: it does not read this list at all** — it renders
// FailureList from /api/posts/failures instead. Two reasons no post-shaped
// filter could do the job:
//
//  - `usePostsData` is capped at the 100 most recent posts, a few days at ES's
//    volume, so an older failure could never appear here however it filtered.
//  - Post-level `status` cannot express a partial failure. Every backend
//    roll-up resolves a post to "sent" as soon as ONE target succeeds, and to
//    "failed" only when they ALL do. A post fanned out to 56 Threads channels
//    that failed on one of them is not a failed post — the failure lives on the
//    target, and that is the grain the Error tab now shows.
const TABS = [
  { id: "queued",    label: "Queued",           match: (p) => ["scheduled", "publishing", "approved"].includes(p.status) },
  { id: "drafts",    label: "Drafts",           match: (p) => p.status === "draft" },
  { id: "pending",   label: "Pending Approval", match: (p) => ["pending_review", "rejected"].includes(p.status) },
  { id: "error",     label: "Error",            failureFeed: true, match: () => false },
  { id: "delivered", label: "Delivered",        match: (p) => ["sent", "deleted"].includes(p.status) },
];

const TYPE_OPTIONS = [
  ["all", "All types"],
  ["video", "Video"],
  ["photo", "Photo"],
  ["link", "Link"],
  ["text", "Text only"],
];

// Media kind of a post, from its media array. Legacy image_url counts as photo.
function derivePostType(p) {
  const media = Array.isArray(p.media) ? p.media : [];
  if (media.some((m) => m?.type === "video")) return "video";
  if (media.some((m) => m?.type === "image") || p.image_url) return "photo";
  if (p.link_url) return "link";
  return "text";
}

export default function PostsView({ onOpenPost, onNavigate, onCompose, me }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const optimisticPosts = useOptimisticPosts();
  const { data, isLoading } = usePostsData();
  const posts = useMemo(() => data?.posts || [], [data]);
  const authors = data?.authors || [];
  const accounts = useMemo(() => data?.accounts || [], [data]);
  const apiKeyMap = useMemo(() => Object.fromEntries((data?.apiKeys || []).map((k) => [k.id, k])), [data]);

  const [tab, setTab] = useState("queued");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Cleared failures are hidden by default; this reveals them. Same gate as the
  // clear action itself, because seeing what was tidied away is part of it.
  const [showCleared, setShowCleared] = useState(false);
  const canClearFailures = me?.role === "admin" || !!me?.is_group_head;

  function togglePostSelect(id) {
    setSelectedPosts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function deletePost(id) {
    if (!confirm("Delete this post?")) return;
    // Remove the card immediately; restore it if the server rejects.
    const rollback = optimisticPosts((list) => list.filter((p) => p.id !== id));
    try {
      await apiJson(`/api/posts/${id}`, { method: "DELETE" });
      showToast("Post deleted.");
      invalidatePosts();
    } catch (err) {
      rollback();
      showToast(err.message, "error");
    }
  }

  async function bulkDeletePosts() {
    if (!selectedPosts.length) return;
    if (!confirm(`Delete ${selectedPosts.length} post(s)? Sent/publishing posts are skipped.`)) return;
    setBulkBusy(true);
    try {
      const r = await apiJson("/api/posts/bulk", { method: "POST", body: JSON.stringify({ action: "delete", ids: selectedPosts }) });
      showToast(`Deleted ${r.affected} post(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
      setSelectedPosts([]);
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkReschedulePosts(newTime) {
    if (!selectedPosts.length || !newTime) return;
    setBulkBusy(true);
    try {
      const r = await apiJson("/api/posts/bulk", { method: "POST", body: JSON.stringify({ action: "reschedule", ids: selectedPosts, scheduledFor: newTime }) });
      showToast(`Rescheduled ${r.affected} post(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
      setSelectedPosts([]);
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  // Re-send failed deliveries. Rows arrive from the Error tab one at a time or
  // in bulk; either way they are grouped by post, because /api/posts/retry
  // retries the failed TARGETS of one post and a single filtered view routinely
  // spans many posts (one bad hour = dozens of posts, one cause).
  async function retryFailures(rows) {
    const eligible = (rows || []).filter((f) => f.postId && f.targetId && !f.externalPostId);
    if (!eligible.length) {
      showToast("Nothing here can be re-sent — those pages already received the post.", "warn");
      return;
    }

    const byPost = new Map();
    for (const f of eligible) {
      if (!byPost.has(f.postId)) byPost.set(f.postId, []);
      byPost.get(f.postId).push(f.targetId);
    }

    let published = 0;
    let failedAgain = 0;
    let skipped = 0;
    const errors = [];

    // Sequential on purpose: each call publishes to real pages, and firing a
    // dozen at once is how a Postiz rate limit (~100 creates/hour for the whole
    // workspace) turns one recoverable outage into a second one.
    for (const [postId, targetIds] of byPost) {
      try {
        const r = await apiJson("/api/posts/retry", {
          method: "POST",
          body: JSON.stringify({ postId, targetIds }),
        });
        published += r.published || 0;
        failedAgain += r.failed || 0;
        skipped += (r.skipped || []).length;
      } catch (err) {
        errors.push(err.message);
      }
    }

    invalidatePosts();

    if (errors.length && !published && !failedAgain) {
      showToast(errors[0], "error");
      return;
    }
    const parts = [`${published} sent`];
    if (failedAgain) parts.push(`${failedAgain} failed again`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (errors.length) parts.push(`${errors.length} request(s) errored`);
    showToast(parts.join(", ") + ".", failedAgain || skipped || errors.length ? "warn" : "ok");
  }

  // How many failures are cleared (hidden) in the current window.
  //
  // Deliberately NOT `?? 0`: the server sends null when it could not tally the
  // hidden rows, and collapsing that to 0 would turn "we don't know" into
  // "there are none" — the one claim this feed must never make. Only undefined
  // (still loading) counts as zero.
  const clearedFailureCount = failureData === undefined ? 0 : failureData?.cleared;

  // Clear (or restore) rows in the Error tab. Hides only — the posts, their
  // errors and their history are untouched, which is what makes this safe to
  // offer next to a Re-send button.
  async function clearFailures({ rows, all, restore } = {}) {
    const body = { restore: !!restore };
    if (all) {
      body.all = true;
      body.days = failureData?.days ?? 90;
    } else {
      body.targetIds = (rows || []).map((f) => f.targetId).filter(Boolean);
      body.postIds = (rows || []).filter((f) => !f.targetId && f.postId).map((f) => f.postId);
      if (!body.targetIds.length && !body.postIds.length) return;
    }
    try {
      const r = await apiJson("/api/posts/failures/clear", { method: "POST", body: JSON.stringify(body) });
      showToast(
        restore
          ? `Restored ${r.affected} failure(s) to the list.`
          : `Cleared ${r.affected} failure(s). Nothing was deleted — "Show cleared" brings them back.`,
      );
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  // Tab counts respect the filters (but not the tab itself).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (authorFilter === "none" ? p.created_by : authorFilter !== "all" && p.created_by !== authorFilter) return false;
      const targets = p.post_targets || [];
      if (accountFilter !== "all" && !targets.some((t) => t.social_account_id === accountFilter)) return false;
      if (platformFilter !== "all" && !targets.some((t) => (t.social_accounts?.platform || t.platform) === platformFilter)) return false;
      if (typeFilter !== "all" && derivePostType(p) !== typeFilter) return false;
      if (sourceFilter !== "all" && (p.source || "app") !== sourceFilter) return false;
      if (q && !(p.body || "").toLowerCase().includes(q)) return false;
      const when = new Date(p.scheduled_for);
      if (dateFrom && when < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && when > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [posts, authorFilter, accountFilter, platformFilter, typeFilter, sourceFilter, search, dateFrom, dateTo]);

  // Failure feed. Fetched even when the Error tab is closed, on purpose: its
  // badge is how anyone finds out a delivery failed at all, and a badge that
  // only counts once you click it is no warning.
  const { data: failureData, isLoading: failuresLoading, error: failuresError } = usePostFailures({ includeCleared: showCleared });
  const allFailures = useMemo(() => failureData?.failures || [], [failureData]);

  // The same filter bar, applied to failure rows. Type is skipped — it is
  // derived from a post's media, which a failure row doesn't carry — and so is
  // the author filter's "none" case, for the same reason.
  const failures = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFailures.filter((f) => {
      if (authorFilter === "none" ? f.createdBy : authorFilter !== "all" && f.createdBy !== authorFilter) return false;
      if (accountFilter !== "all" && f.accountId !== accountFilter) return false;
      if (platformFilter !== "all" && f.platform !== platformFilter) return false;
      if (sourceFilter !== "all" && (f.source || "app") !== sourceFilter) return false;
      if (q && !(f.body || "").toLowerCase().includes(q) && !(f.channel || "").toLowerCase().includes(q)) return false;
      const when = f.when ? new Date(f.when) : null;
      if (dateFrom && (!when || when < new Date(`${dateFrom}T00:00:00`))) return false;
      if (dateTo && (!when || when > new Date(`${dateTo}T23:59:59`))) return false;
      return true;
    });
  }, [allFailures, authorFilter, accountFilter, platformFilter, sourceFilter, search, dateFrom, dateTo]);

  // Lets a failure row open its post when the post is still inside
  // usePostsData's 100-post window. Older ones show without a link.
  const postsById = useMemo(() => Object.fromEntries(posts.map((p) => [p.id, p])), [posts]);

  const tabCounts = useMemo(() => {
    const counts = {};
    // "?" rather than 0 when the feed is unreachable: a confident zero on the
    // Error badge is a claim we cannot make, and is how a failure goes unnoticed.
    for (const t of TABS) {
      counts[t.id] = t.failureFeed
        ? failuresError
          ? "?"
          : failures.length
        : filtered.filter(t.match).length;
    }
    return counts;
  }, [filtered, failures, failuresError]);

  const activeTab = TABS.find((t) => t.id === tab);
  const visiblePosts = filtered.filter(activeTab.match);

  const platformsInUse = useMemo(() => {
    const set = new Set(accounts.map((a) => a.platform));
    return ["facebook", "instagram", "threads", "twitter", "youtube"].filter((p) => set.has(p));
  }, [accounts]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedPosts([]); }}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold ${
              tab === t.id
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400"
                : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              tab === t.id ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400"
            }`}>
              {tabCounts[t.id]}
            </span>
          </button>
        ))}
        <button onClick={() => setShowImport(true)}
          className="ml-auto mb-1.5 flex items-center gap-1.5 self-center rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <FileText size={14} /> Import CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 shadow-sm">
        <div className="flex min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
          <Search size={13} className="text-slate-400 dark:text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions…"
            className="w-full flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500" />
          {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none">
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none">
          <option value="all">All platforms</option>
          {platformsInUse.map((p) => <option key={p} value={p}>{PLATFORM_META[p]?.label || p}</option>)}
        </select>
        {/* Hidden on the Error tab: content type is derived from a post's
            media, and a failure row is per-channel and carries none. A control
            that silently does nothing is worse than one that isn't there. */}
        {!activeTab.failureFeed && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} title="Content type"
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none">
            {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} title="How the post was created"
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none">
          <option value="all">Any source</option>
          <option value="app">App</option>
          <option value="api">API</option>
          <option value="csv">CSV import</option>
          <option value="recycle">Recycled</option>
        </select>
        {authors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-400 dark:text-gray-500" />
            <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none">
              <option value="all">Everyone</option>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              <option value="none">Unattributed</option>
            </select>
          </div>
        )}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date"
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date"
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none" />
        {(search || accountFilter !== "all" || platformFilter !== "all" || typeFilter !== "all" || authorFilter !== "all" || sourceFilter !== "all" || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setAccountFilter("all"); setPlatformFilter("all"); setTypeFilter("all"); setAuthorFilter("all"); setSourceFilter("all"); setDateFrom(""); setDateTo(""); }}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk bar */}
      {selectedPosts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5">
          <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{selectedPosts.length} selected</span>
          <input
            type="datetime-local"
            onChange={(e) => { if (e.target.value) { bulkReschedulePosts(new Date(e.target.value).toISOString()); e.target.value = ""; } }}
            disabled={bulkBusy}
            className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 outline-none"
            title="Reschedule selected"
          />
          <button onClick={bulkDeletePosts} disabled={bulkBusy} className="rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">Delete</button>
          <button onClick={() => setSelectedPosts([])} className="ml-auto text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline">Clear</button>
        </div>
      )}

      {/* List. The Error tab renders the failure feed instead of post cards —
          see TABS. */}
      {activeTab.failureFeed ? (
        failuresLoading ? (
          <PostListSkeleton />
        ) : (
          <FailureList
            failures={failures}
            days={failureData?.days ?? 90}
            truncated={!!failureData?.truncated}
            error={failuresError}
            onOpenPost={onOpenPost}
            postsById={postsById}
            onRetry={retryFailures}
            onClear={canClearFailures ? clearFailures : null}
            clearedCount={clearedFailureCount}
            showCleared={showCleared}
            onToggleCleared={setShowCleared}
          />
        )
      ) : isLoading ? (
        <PostListSkeleton />
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <LayoutList size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-slate-500 dark:text-gray-400 text-sm">No posts yet.</p>
          <button onClick={() => onNavigate("compose")} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Create your first post →
          </button>
        </div>
      ) : visiblePosts.length === 0 ? (
        <p className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">
          Nothing in {activeTab.label} matches the current filters.
        </p>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={authorMap[post.created_by]}
              apiKeyName={post.source === "api" ? apiKeyMap[post.api_key_id]?.name : undefined}
              onDelete={deletePost}
              onOpen={() => onOpenPost(post)}
              onDuplicate={() => onCompose({ post })}
              selected={selectedPosts.includes(post.id)}
              onToggleSelect={() => togglePostSelect(post.id)}
            />
          ))}
        </div>
      )}

      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
