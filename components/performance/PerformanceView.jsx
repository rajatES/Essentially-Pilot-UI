"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Heart, MessageCircle, Share2, Eye, TrendingUp, RefreshCw, Filter } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { useInsights } from "@/lib/queries";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";

const RANGES = [
  [7, "7d"],
  [14, "14d"],
  [30, "30d"],
  [90, "90d"],
];

const SORTS = [
  ["engagement", "Most engagement"],
  ["likes", "Most likes"],
  ["comments", "Most comments"],
  ["shares", "Most shares"],
  ["recent", "Most recent"],
];

const TYPE_OPTIONS = [
  ["all", "All types"],
  ["video", "Video"],
  ["photo", "Photo"],
  ["link", "Link"],
  ["text", "Text only"],
];

// Compact number formatting (1.2K / 3.4M).
function fmt(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

export default function PerformanceView() {
  const qc = useQueryClient();
  const showToast = useToast();
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState("all");
  const [sport, setSport] = useState("all");
  const [pageFilter, setPageFilter] = useState("all");
  const [postType, setPostType] = useState("all");
  const [sortKey, setSortKey] = useState("engagement");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useInsights(days);
  const posts = useMemo(() => data?.posts || [], [data]);

  async function refreshAll() {
    setRefreshing(true);
    try {
      const r = await apiJson("/api/insights/refresh", { method: "POST", body: JSON.stringify({}) });
      qc.invalidateQueries({ queryKey: ["insights"] });
      showToast(`Refreshed ${r.synced} post target(s)${r.failed ? `, ${r.failed} failed` : ""}.`, r.failed ? "warn" : "ok");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRefreshing(false);
    }
  }

  const sportOptions = useMemo(() => [...new Set(posts.map((p) => p.category || "Other"))].sort(), [posts]);
  const platformOptions = useMemo(() => [...new Set(posts.flatMap((p) => p.platforms || []))].sort(), [posts]);
  const pageOptions = useMemo(() => [...new Set(posts.flatMap((p) => p.pages || []))].sort(), [posts]);

  const filtered = useMemo(() => {
    let list = posts.filter((p) => {
      const matchesPlatform = platform === "all" || (p.platforms || []).includes(platform);
      const matchesSport = sport === "all" || (p.category || "Other") === sport;
      const matchesPage = pageFilter === "all" || (p.pages || []).includes(pageFilter);
      const matchesType = postType === "all" || p.postType === postType;
      return matchesPlatform && matchesSport && matchesPage && matchesType;
    });
    const sorters = {
      engagement: (a, b) => b.engagement - a.engagement,
      likes: (a, b) => b.likes - a.likes,
      comments: (a, b) => b.comments - a.comments,
      shares: (a, b) => b.shares - a.shares,
      recent: (a, b) => new Date(b.sent_at) - new Date(a.sent_at),
    };
    return [...list].sort(sorters[sortKey] || sorters.engagement);
  }, [posts, platform, sport, pageFilter, postType, sortKey]);

  const totals = useMemo(() => {
    const t = { posts: filtered.length, withInsights: 0, likes: 0, comments: 0, shares: 0, engagement: 0 };
    for (const p of filtered) {
      if (p.hasInsights) t.withInsights++;
      t.likes += p.likes;
      t.comments += p.comments;
      t.shares += p.shares;
      t.engagement += p.engagement;
    }
    return t;
  }, [filtered]);

  // Top pages by engagement (simple horizontal bars).
  const topPages = useMemo(() => {
    const map = {};
    for (const p of filtered) {
      const per = p.engagement / Math.max(p.pages.length, 1);
      for (const page of p.pages) map[page] = (map[page] || 0) + per;
    }
    const arr = Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const max = Math.max(1, ...arr.map((a) => a.value));
    return arr.map((a) => ({ ...a, pct: Math.round((a.value / max) * 100) }));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <TrendingUp size={20} /> Performance
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Engagement on published posts, fetched by post ID from each platform{data?.windowDays ? ` · last ${data.windowDays} days` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-gray-700">
            {RANGES.map(([d, label]) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${days === d ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            title="Fetch the latest metrics from each platform now"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh insights
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={BarChart3} label="Posts" value={totals.posts} sub={`${totals.withInsights} with insights`} />
        <Kpi icon={TrendingUp} label="Engagement" value={fmt(totals.engagement)} sub={totals.posts ? `${fmt(Math.round(totals.engagement / totals.posts))}/post` : "—"} />
        <Kpi icon={Heart} label="Likes" value={fmt(totals.likes)} />
        <Kpi icon={MessageCircle} label="Comments" value={fmt(totals.comments)} />
        <Kpi icon={Share2} label="Shares" value={fmt(totals.shares)} />
        <Kpi icon={Eye} label="Avg engagement" value={totals.posts ? fmt(Math.round(totals.engagement / totals.posts)) : "0"} sub="per post" />
      </div>

      {/* Top pages */}
      {topPages.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-gray-200">Top pages by engagement</p>
          <div className="space-y-2">
            {topPages.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs text-slate-600 dark:text-gray-300" title={p.name}>{p.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-medium text-slate-500 dark:text-gray-400">{fmt(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
        <Filter size={14} className="text-slate-400 dark:text-gray-500" />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
          <option value="all">All platforms</option>
          {platformOptions.map((p) => <option key={p} value={p}>{PLATFORM_META[p]?.label || p}</option>)}
        </select>
        <select value={sport} onChange={(e) => setSport(e.target.value)} className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
          <option value="all">All sports</option>
          {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
          <option value="all">All pages</option>
          {pageOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={postType} onChange={(e) => setPostType(e.target.value)} title="Content type" className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
          {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="ml-auto rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500">
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {/* Post list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
          <BarChart3 size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No published posts in this range</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Once posts go out, hit <strong>Refresh insights</strong> to pull their metrics.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
              <Thumb url={p.image_url} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {(p.platforms || []).map((pl) => <PlatformIcon key={pl} platform={pl} size={12} />)}
                  <span className="truncate text-xs text-slate-500 dark:text-gray-400">
                    {p.pages.slice(0, 2).join(", ")}{p.pages.length > 2 ? ` +${p.pages.length - 2}` : ""} · {p.category}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-slate-700 dark:text-gray-200">{p.body || "(no caption)"}</p>
                <p className="text-[11px] text-slate-400 dark:text-gray-500">{p.sent_at ? new Date(p.sent_at).toLocaleString() : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                {p.hasInsights ? (
                  <>
                    <Metric icon={Heart} value={p.likes} />
                    <Metric icon={MessageCircle} value={p.comments} />
                    <Metric icon={Share2} value={p.shares} />
                    <div className="w-14 text-right">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{fmt(p.engagement)}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500">engmt</p>
                    </div>
                  </>
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-slate-400 dark:text-gray-500">No insights yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value }) {
  return (
    <span className="flex items-center gap-1 text-slate-500 dark:text-gray-400">
      <Icon size={13} /> {fmt(value)}
    </span>
  );
}

function ImageFallback() {
  return <BarChart3 size={18} />;
}

// Show the placeholder when the image is missing or fails to load.
function Thumb({ url }) {
  const [ok, setOk] = useState(true);
  if (url && ok) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={url} alt="" onError={() => setOk(false)} className="h-14 w-14 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600">
      <ImageFallback />
    </div>
  );
}
