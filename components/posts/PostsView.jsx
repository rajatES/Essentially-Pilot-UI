"use client";

import { useMemo, useState } from "react";
import { FileText, LayoutList, Search, Users, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { PLATFORM_META } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsData, usePostsInvalidate, useOptimisticPosts } from "@/lib/queries";
import PostCard from "./PostCard";
import CsvImportModal from "./CsvImportModal";
import { PostListSkeleton } from "@/components/common/Skeleton";

// SocialPilot-style Manage Posts: status tabs + combined filters.
const TABS = [
  { id: "queued",    label: "Queued",           statuses: ["scheduled", "publishing", "approved"] },
  { id: "drafts",    label: "Drafts",           statuses: ["draft"] },
  { id: "pending",   label: "Pending Approval", statuses: ["pending_review", "rejected"] },
  { id: "error",     label: "Error",            statuses: ["failed"] },
  { id: "delivered", label: "Delivered",        statuses: ["sent", "deleted"] },
];

export default function PostsView({ onOpenPost, onNavigate, onCompose }) {
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
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);

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

  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  // Tab counts respect the filters (but not the tab itself).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (authorFilter === "none" ? p.created_by : authorFilter !== "all" && p.created_by !== authorFilter) return false;
      const targets = p.post_targets || [];
      if (accountFilter !== "all" && !targets.some((t) => t.social_account_id === accountFilter)) return false;
      if (platformFilter !== "all" && !targets.some((t) => (t.social_accounts?.platform || t.platform) === platformFilter)) return false;
      if (sourceFilter !== "all" && (p.source || "app") !== sourceFilter) return false;
      if (q && !(p.body || "").toLowerCase().includes(q)) return false;
      const when = new Date(p.scheduled_for);
      if (dateFrom && when < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && when > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [posts, authorFilter, accountFilter, platformFilter, sourceFilter, search, dateFrom, dateTo]);

  const tabCounts = useMemo(() => {
    const counts = {};
    for (const t of TABS) counts[t.id] = filtered.filter((p) => t.statuses.includes(p.status)).length;
    return counts;
  }, [filtered]);

  const activeTab = TABS.find((t) => t.id === tab);
  const visiblePosts = filtered.filter((p) => activeTab.statuses.includes(p.status));

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
        {(search || accountFilter !== "all" || platformFilter !== "all" || authorFilter !== "all" || sourceFilter !== "all" || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setAccountFilter("all"); setPlatformFilter("all"); setAuthorFilter("all"); setSourceFilter("all"); setDateFrom(""); setDateTo(""); }}
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

      {/* List */}
      {isLoading ? (
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
