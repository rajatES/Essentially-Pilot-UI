"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  CalendarClock, XCircle, FileText, Send, Users, Facebook, Instagram,
  Activity, TrendingUp, Clock, AlertTriangle, Link as LinkIcon, CheckCircle2, RefreshCw
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const PIE_COLORS = ["#2864d8", "#e1306c", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#64748b"];

function fmtWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatCard({ icon: Icon, label, value, tone = "slate", onClick }) {
  const tones = {
    slate: "text-slate-600 bg-slate-100 dark:text-gray-300 dark:bg-gray-800",
    blue: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20",
    green: "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-500/20",
    red: "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-500/20",
    amber: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20",
    pink: "text-pink-600 bg-pink-100 dark:text-pink-300 dark:bg-pink-500/20",
    violet: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20"
  };
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 ${onClick ? "hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/50" : "cursor-default"}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-800 dark:text-white">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-gray-400">{label}</p>
      </div>
    </button>
  );
}

function Panel({ title, icon: Icon, children, action }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
          {Icon && <Icon size={15} className="text-slate-400 dark:text-gray-500" />} {title}
        </p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const ACTIVITY_ICON = {
  "post.published": CheckCircle2,
  "post.scheduled": CalendarClock,
  "post.failed": XCircle,
  "account.connected": LinkIcon
};
const ACTIVITY_TONE = {
  success: "text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-500/10",
  error: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/10",
  warning: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
  info: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10"
};

export default function DashboardView({ onNavigate }) {
  const [recycling, setRecycling] = useState(null);

  async function recyclePost(postId) {
    setRecycling(postId);
    try {
      const r = await apiFetch("/api/posts/recycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Recycle failed.");
      alert(`Queued a copy for ${new Date(d.post.scheduled_for).toLocaleString()}. It publishes automatically.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setRecycling(null);
    }
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard.");
      return json;
    }
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="mx-auto max-w-6xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error.message}</p>;
  }

  const d = data;
  const c = d.charts;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Operations Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Live overview of your publishing pipeline</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={CalendarClock} label="Scheduled" value={d.statusCounts.scheduled} tone="blue" onClick={() => onNavigate?.("calendar")} />
        <StatCard icon={XCircle} label="Failed" value={d.statusCounts.failed} tone="red" onClick={() => onNavigate?.("queue")} />
        <StatCard icon={FileText} label="Drafts" value={d.statusCounts.draft} tone="slate" />
        <StatCard icon={Send} label="Published today" value={d.publishedToday} tone="green" />
        <StatCard icon={TrendingUp} label="Avg posts / day" value={d.avgPerDay} tone="violet" />
        <StatCard icon={Users} label="Accounts" value={d.accountCounts.total} tone="slate" onClick={() => onNavigate?.("accounts")} />
        <StatCard icon={Facebook} label="Facebook" value={d.accountCounts.facebook} tone="blue" />
        <StatCard icon={Instagram} label="Instagram" value={d.accountCounts.instagram} tone="pink" />
        <StatCard icon={Clock} label="Due today" value={d.postsToday} tone="amber" />
        <StatCard icon={CalendarClock} label="Next 7 days" value={d.postsThisWeek} tone="blue" />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Posts by day (last 14 days)" icon={Activity}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={c.byDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} width={28} />
                <Tooltip />
                <Bar dataKey="posts" fill="#2864d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
        <Panel title="Publishing success" icon={CheckCircle2}>
          <div className="flex h-[220px] flex-col items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={[{ name: "Sent", value: c.sent }, { name: "Failed", value: c.failed }]} dataKey="value" innerRadius={55} outerRadius={75} startAngle={90} endAngle={-270}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#ef4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{c.successRate ?? "—"}%</span>
                <span className="text-xs text-slate-400 dark:text-gray-500">success</span>
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" /> {c.sent} sent</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {c.failed} failed</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Posts by platform" icon={Activity}>
          {c.byPlatform.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={c.byPlatform} dataKey="value" nameKey="name" outerRadius={75} label={(e) => e.name}>
                  {c.byPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>
        <Panel title="Top sports" icon={TrendingUp}>
          {c.topSports.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={c.topSports} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>
        <Panel title="Top active pages" icon={Users}>
          {c.topPages.length ? (
            <div className="space-y-2">
              {c.topPages.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-4 text-xs font-bold text-slate-400 dark:text-gray-500">{i + 1}</span>
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-gray-200">{p.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">{p.value}</span>
                </div>
              ))}
            </div>
          ) : <Empty />}
        </Panel>
      </div>

      {/* Top posts by engagement */}
      <Panel
        title={`Top posts by engagement${d.totalEngagement ? ` — ${d.totalEngagement.toLocaleString()} total` : ""}`}
        icon={TrendingUp}
      >
        {(d.topPosts || []).length ? (
          <div className="space-y-2">
            {d.topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 dark:border-gray-800">
                <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400 dark:text-gray-500">{i + 1}</span>
                {p.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200 dark:border-gray-800" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-slate-100 dark:bg-gray-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700 dark:text-gray-200">{p.body || "(no caption)"}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">
                    👍 {p.likes.toLocaleString()} · 💬 {p.comments.toLocaleString()} · ↗ {p.shares.toLocaleString()}
                    {p.reach ? ` · ${p.reach.toLocaleString()} reach` : ""}
                    {p.pages.length ? ` · ${p.pages[0]}${p.pages.length > 1 ? ` +${p.pages.length - 1}` : ""}` : ""}
                  </p>
                  {p.link_url ? (
                    <a
                      href={p.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <LinkIcon size={11} className="shrink-0" /> <span className="truncate">{p.link_url}</span>
                    </a>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-500/20 dark:text-green-300">
                  {p.engagement.toLocaleString()}
                </span>
                <button
                  onClick={() => recyclePost(p.id)}
                  disabled={recycling === p.id}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                  title="Queue a copy of this post for tomorrow"
                >
                  <RefreshCw size={12} className={recycling === p.id ? "animate-spin" : ""} /> Repost
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No engagement data yet — insights sync runs every 6 hours (or trigger /api/cron/insights)" />
        )}
      </Panel>

      {/* Lists row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Upcoming scheduled" icon={CalendarClock} action={<button onClick={() => onNavigate?.("calendar")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Calendar →</button>}>
          {d.upcoming.length ? (
            <div className="space-y-2">
              {d.upcoming.map((p) => (
                <div key={p.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-gray-800">
                  {p.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover border border-slate-200 dark:border-gray-800" />
                  ) : (
                    <CalendarClock size={14} className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700 dark:text-gray-200">{p.body || "(no caption)"}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500">{fmtWhen(p.scheduled_for)}</p>
                    {p.link_url ? (
                      <a
                        href={p.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <LinkIcon size={11} className="shrink-0" /> <span className="truncate">{p.link_url}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="Nothing scheduled" />}
        </Panel>

        <Panel title="Recent activity" icon={Activity}>
          {d.recentActivity.length ? (
            <div className="space-y-2">
              {d.recentActivity.slice(0, 8).map((a) => {
                const Icon = ACTIVITY_ICON[a.type] || Activity;
                return (
                  <div key={a.id} className="flex items-start gap-2">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ACTIVITY_TONE[a.status] || ACTIVITY_TONE.info}`}>
                      <Icon size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700 dark:text-gray-200">{a.title}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500">{ago(a.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty text="No activity yet" />}
        </Panel>

        <Panel title="Recent failures" icon={AlertTriangle}>
          {d.recentFailures.length ? (
            <div className="space-y-2">
              {d.recentFailures.map((a) => (
                <div key={a.id} className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 dark:bg-red-500/10">
                  <XCircle size={14} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-red-700 dark:text-red-300">{a.title}</p>
                    <p className="text-xs text-red-400 dark:text-red-400/70">{ago(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="No failures 🎉" />}
        </Panel>
      </div>

      {/* Coverage gaps */}
      <Panel
        title={`Coverage gaps — nothing scheduled in the next 48h${(d.coverageGaps || []).length ? ` (${d.coverageGaps.length} page${d.coverageGaps.length !== 1 ? "s" : ""})` : ""}`}
        icon={AlertTriangle}
        action={<button onClick={() => onNavigate?.("accounts")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Accounts →</button>}
      >
        {(d.coverageGaps || []).length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.coverageGaps.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                <span className="truncate text-sm text-amber-800 dark:text-amber-300">{a.displayName}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:bg-gray-900 dark:text-amber-400">{a.category}</span>
              </div>
            ))}
          </div>
        ) : <Empty text="Every page has something scheduled in the next 48 hours 🎉" />}
      </Panel>
    </div>
  );
}

function Empty({ text = "No data yet" }) {
  return <p className="py-8 text-center text-sm text-slate-400 dark:text-gray-500">{text}</p>;
}
