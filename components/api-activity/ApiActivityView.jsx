"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Webhook, RefreshCw, KeyRound, CheckCircle2, Clock, XCircle, Filter, BarChart3 } from "lucide-react";
import { fmt } from "@/lib/platformMeta";
import { useApiActivity } from "@/lib/queries";
import PostCard from "@/components/posts/PostCard";

// Statuses offered in the filter — mirrors the buckets the backend rolls up.
const STATUS_OPTIONS = [
  ["", "Any status"],
  ["sent", "Sent"],
  ["scheduled", "Scheduled"],
  ["publishing", "Publishing"],
  ["failed", "Failed"],
  ["draft", "Draft"],
  ["pending_review", "Pending review"],
];

function Kpi({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-500 dark:text-gray-400",
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className={`flex items-center gap-2 ${tones[tone]}`}>
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

export default function ApiActivityView({ onOpenPost, onCompose }) {
  const qc = useQueryClient();
  const [keyId, setKeyId] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error } = useApiActivity({ keyId, status });

  const posts = useMemo(() => data?.posts || [], [data]);
  const usage = useMemo(() => data?.usage || [], [data]);
  const apiKeys = useMemo(() => data?.apiKeys || [], [data]);
  const apiKeyMap = useMemo(() => Object.fromEntries(apiKeys.map((k) => [k.id, k])), [apiKeys]);

  // Totals across every key + unattributed posts (independent of the filters).
  const totals = useMemo(() => {
    const t = { total: 0, sent: 0, scheduled: 0, failed: 0 };
    for (const u of usage) {
      t.total += u.total || 0;
      t.sent += u.sent || 0;
      t.scheduled += u.scheduled || 0;
      t.failed += u.failed || 0;
    }
    const un = data?.unattributed;
    if (un) {
      t.total += un.total || 0;
      t.sent += un.sent || 0;
      t.scheduled += un.scheduled || 0;
      t.failed += un.failed || 0;
    }
    return t;
  }, [usage, data]);

  const nothingEver = !isLoading && !isError && (data?.totalApiPosts || 0) === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <Webhook size={20} /> API Activity
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Posts created through the Developer API (<code>/api/v1/posts</code>), attributed to the key that made them.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["api-activity"] })}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300">
          {error?.message?.includes("admin") ? "Only admins can view API activity." : error?.message || "Couldn't load API activity."}
        </div>
      ) : nothingEver ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
          <Webhook size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No posts have come in via the API yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-gray-400">
            Mint a key in <strong>Settings → Developer API keys</strong>, then have your automation call{" "}
            <code>POST /api/v1/posts</code>. Anything it creates shows up here.
          </p>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={BarChart3} label="API posts" value={totals.total} />
            <Kpi icon={CheckCircle2} label="Sent" value={totals.sent} tone="green" />
            <Kpi icon={Clock} label="Scheduled" value={totals.scheduled} tone="blue" />
            <Kpi icon={XCircle} label="Failed" value={totals.failed} tone="red" />
          </div>

          {/* Per-key usage */}
          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="border-b border-slate-100 dark:border-gray-800 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
                <KeyRound size={14} /> Usage by key
              </p>
            </div>
            {usage.length === 0 ? (
              <p className="px-4 py-4 text-xs text-slate-400 dark:text-gray-500">No API keys yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {usage.map((u) => {
                  const active = keyId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setKeyId(active ? "" : u.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-gray-800/50"}`}
                      title={active ? "Clear filter" : "Filter posts to this key"}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800 dark:text-white">
                          {u.name}
                          {u.revoked_at && (
                            <span className="rounded bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">REVOKED</span>
                          )}
                          {active && <span className="rounded bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">FILTERED</span>}
                        </p>
                        <p className="truncate text-xs text-slate-400 dark:text-gray-500">
                          <code>{u.key_prefix}</code> · last post {u.lastPostAt ? fmt(u.lastPostAt) : "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs">
                        <span className="text-slate-400 dark:text-gray-500">{u.sent}✓ · {u.scheduled}◷ · {u.failed}✗</span>
                        <div className="w-12 text-right">
                          <p className="text-base font-bold text-slate-800 dark:text-white">{u.total}</p>
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">posts</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <Filter size={14} className="text-slate-400 dark:text-gray-500" />
            <select value={keyId} onChange={(e) => setKeyId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
              <option value="">All keys</option>
              {apiKeys.map((k) => <option key={k.id} value={k.id}>{k.name}{k.revoked_at ? " (revoked)" : ""}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
              {STATUS_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            {(keyId || status) && (
              <button onClick={() => { setKeyId(""); setStatus(""); }} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400 dark:text-gray-500">{posts.length} shown</span>
          </div>

          {/* Post list — same cards as the Posts view */}
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">
              No API posts match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  apiKeyName={apiKeyMap[post.api_key_id]?.name}
                  onOpen={() => onOpenPost(post)}
                  onDuplicate={onCompose ? () => onCompose({ post }) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
