"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Plus } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { STATUS_STYLES, statusLabel, fmt, PLATFORM_META } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsData, usePostsInvalidate, useOptimisticPosts } from "@/lib/queries";

// Statuses that may be dragged to a new date (backend rejects sent/publishing).
const DRAGGABLE = new Set(["draft", "scheduled", "pending_review", "approved", "rejected", "failed"]);
const STATUS_FILTERS = ["scheduled", "draft", "pending_review", "sent", "failed"];

// Calendar view: month/week/day/list + drag-drop rescheduling + filters +
// click-a-day to compose. Chips carry the post id via HTML5 drag-and-drop;
// dropping on a day keeps the post's original time of day.
export default function CalendarView({ onOpenPost, onCompose }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const optimisticPosts = useOptimisticPosts();
  const { data } = usePostsData();
  const allPosts = useMemo(() => data?.posts || [], [data]);
  const accounts = useMemo(() => data?.accounts || [], [data]);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView] = useState("month"); // month | week | day | list
  const [calAnchor, setCalAnchor] = useState(now.toISOString()); // ref date for week/day
  const [accountFilter, setAccountFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dragOverKey, setDragOverKey] = useState(null); // highlighted drop cell

  const posts = useMemo(() => {
    return allPosts.filter((p) => {
      const targets = p.post_targets || [];
      if (accountFilter !== "all" && !targets.some((t) => t.social_account_id === accountFilter)) return false;
      if (platformFilter !== "all" && !targets.some((t) => (t.social_accounts?.platform || t.platform) === platformFilter)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [allPosts, accountFilter, platformFilter, statusFilter]);

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const offset = first.getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const post of posts) {
      const d = new Date(post.scheduled_for);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = d.getDate();
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    }
    return map;
  }, [posts, calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth).toLocaleString(undefined, {
    month: "long", year: "numeric"
  });

  const weekDays = useMemo(() => {
    const anchor = new Date(calAnchor);
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calAnchor]);

  function postsOnDate(dateObj) {
    return posts
      .filter((p) => {
        const d = new Date(p.scheduled_for);
        return d.getFullYear() === dateObj.getFullYear() &&
          d.getMonth() === dateObj.getMonth() &&
          d.getDate() === dateObj.getDate();
      })
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  }

  // ── drag & drop rescheduling ─────────────────────────────────────────────

  function onChipDragStart(e, post) {
    e.dataTransfer.setData("text/plain", post.id);
    e.dataTransfer.effectAllowed = "move";
  }

  async function dropOnDate(e, targetDate) {
    e.preventDefault();
    setDragOverKey(null);
    const postId = e.dataTransfer.getData("text/plain");
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;

    // Keep the post's original time of day on the new date.
    const orig = new Date(post.scheduled_for);
    const next = new Date(targetDate);
    next.setHours(orig.getHours(), orig.getMinutes(), 0, 0);

    if (next.getTime() < Date.now()) {
      showToast("Can't reschedule into the past.", "warn");
      return;
    }

    // Move the chip to the new day immediately; restore on failure.
    const nextIso = next.toISOString();
    const rollback = optimisticPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, scheduled_for: nextIso } : p)),
    );
    try {
      const r = await apiJson(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledFor: nextIso }),
      });
      showToast(r.warning ? `Rescheduled — Facebook note: ${r.warning}` : `Rescheduled to ${fmt(nextIso)}.`, r.warning ? "warn" : "ok");
      invalidatePosts();
    } catch (err) {
      rollback();
      showToast(err.message, "error");
    }
  }

  const cellDropProps = (dateObj, key) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverKey(key); },
    onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
    onDrop: (e) => dropOnDate(e, dateObj),
  });

  const chipClass = (post) =>
    `${DRAGGABLE.has(post.status) ? "cursor-grab active:cursor-grabbing" : ""} flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-80 ${
      post.status === "sent" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300"
      : post.status === "failed" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
      : post.status === "deleted" ? "bg-slate-700 dark:bg-gray-700 text-white"
      : post.status === "publishing" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
      : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
    }`;

  const platformsInUse = useMemo(() => {
    const set = new Set(accounts.map((a) => a.platform));
    return ["facebook", "instagram", "threads", "twitter", "youtube"].filter((p) => set.has(p));
  }, [accounts]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (calView === "month") {
                if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1);
              } else {
                const d = new Date(calAnchor);
                d.setDate(d.getDate() - (calView === "week" ? 7 : 1));
                setCalAnchor(d.toISOString());
              }
            }}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              if (calView === "month") {
                if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1);
              } else {
                const d = new Date(calAnchor);
                d.setDate(d.getDate() + (calView === "week" ? 7 : 1));
                setCalAnchor(d.toISOString());
              }
            }}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/50"
          >
            <ChevronRight size={16} />
          </button>
          <p className="ml-1 font-semibold text-slate-800 dark:text-white">
            {calView === "month" ? monthLabel
              : calView === "week" ? `Week of ${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : calView === "day" ? new Date(calAnchor).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
              : "All posts"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300 outline-none">
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300 outline-none">
            <option value="all">All platforms</option>
            {platformsInUse.map((p) => <option key={p} value={p}>{PLATFORM_META[p]?.label || p}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300 outline-none">
            <option value="all">All statuses</option>
            {STATUS_FILTERS.map((s) => <option key={s} value={s} className="capitalize">{statusLabel(s)}</option>)}
          </select>
          <div className="flex rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5">
            {["month", "week", "day", "list"].map((v) => (
              <button
                key={v}
                onClick={() => setCalView(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                  calView === v ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MONTH */}
      {calView === "month" && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-gray-800">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 dark:text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const td = new Date();
              const isToday = day && calYear === td.getFullYear() && calMonth === td.getMonth() && day === td.getDate();
              const dayPosts = day ? (postsByDay[day] || []) : [];
              const cellDate = day ? new Date(calYear, calMonth, day) : null;
              const isPast = cellDate && cellDate < new Date(td.getFullYear(), td.getMonth(), td.getDate());
              const key = `m-${i}`;
              return (
                <div
                  key={i}
                  {...(day ? cellDropProps(cellDate, key) : {})}
                  onClick={day && !isPast && onCompose ? () => {
                    const at = new Date(cellDate);
                    at.setHours(isToday ? Math.min(td.getHours() + 1, 23) : 10, 0, 0, 0);
                    const off = at.getTimezoneOffset();
                    onCompose({ scheduledFor: new Date(at.getTime() - off * 60000).toISOString().slice(0, 16) });
                  } : undefined}
                  className={`group min-h-[110px] border-b border-r border-slate-100 dark:border-gray-800 p-1.5 ${!day ? "bg-slate-50 dark:bg-gray-800/50" : ""} ${
                    dragOverKey === key ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-500/40" : ""
                  } ${day && !isPast && onCompose ? "cursor-pointer" : ""}`}
                >
                  {day && (
                    <>
                      <span className="mb-1 flex items-center justify-between">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-gray-200"}`}>
                          {day}
                        </span>
                        {!isPast && onCompose && (
                          <Plus size={12} className="opacity-0 transition-opacity group-hover:opacity-100 text-indigo-500" />
                        )}
                      </span>
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 4).map((post) => (
                          <button
                            key={post.id}
                            draggable={DRAGGABLE.has(post.status)}
                            onDragStart={(e) => onChipDragStart(e, post)}
                            onClick={(e) => { e.stopPropagation(); onOpenPost(post); }}
                            className={chipClass(post)}
                            title={post.body}
                          >
                            {post.image_url && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={post.image_url} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" />
                            )}
                            <span className="truncate">{new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })} {post.body.slice(0, 22)}</span>
                          </button>
                        ))}
                        {dayPosts.length > 4 && (
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">+{dayPosts.length - 4} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK */}
      {calView === "week" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const dayPosts = postsOnDate(d);
            const td = new Date();
            const isToday = d.toDateString() === td.toDateString();
            const key = `w-${i}`;
            return (
              <div
                key={d.toISOString()}
                {...cellDropProps(d, key)}
                className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden ${
                  dragOverKey === key ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-gray-800"
                }`}
              >
                <div className={`px-2 py-2 text-center border-b border-slate-100 dark:border-gray-800 ${isToday ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                  <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-gray-500">{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                  <p className={`text-sm font-bold ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-gray-200"}`}>{d.getDate()}</p>
                </div>
                <div className="min-h-[300px] space-y-1 p-1.5">
                  {dayPosts.map((post) => (
                    <button
                      key={post.id}
                      draggable={DRAGGABLE.has(post.status)}
                      onDragStart={(e) => onChipDragStart(e, post)}
                      onClick={() => onOpenPost(post)}
                      className={`block w-full overflow-hidden rounded text-left text-[10px] font-medium leading-tight hover:opacity-80 ${DRAGGABLE.has(post.status) ? "cursor-grab active:cursor-grabbing" : ""} ${
                        post.status === "sent" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300"
                        : post.status === "failed" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                        : post.status === "deleted" ? "bg-slate-700 dark:bg-gray-700 text-white"
                        : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                      }`}
                    >
                      {post.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={post.image_url} alt="" className="h-14 w-full object-cover" />
                      )}
                      <span className="block px-1.5 py-1">
                        {new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}<br />
                        {post.body.slice(0, 40)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAY */}
      {calView === "day" && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-slate-100 dark:divide-gray-800">
          {postsOnDate(new Date(calAnchor)).length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-gray-400">No posts on this day.</p>
          ) : (
            postsOnDate(new Date(calAnchor)).map((post) => (
              <CalRow key={post.id} post={post} onClick={() => onOpenPost(post)} />
            ))
          )}
        </div>
      )}

      {/* LIST */}
      {calView === "list" && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-slate-100 dark:divide-gray-800">
          {posts.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-gray-400">No posts match the filters.</p>
          ) : (
            [...posts].sort((a, b) => new Date(b.scheduled_for) - new Date(a.scheduled_for))
              .map((post) => (
                <CalRow key={post.id} post={post} onClick={() => onOpenPost(post)} showDate />
              ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── CalRow: a post row for Day / List calendar views ────────────────────────

function CalRow({ post, onClick, showDate }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-800/50">
      {post.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={post.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200 dark:border-gray-800" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600"><ImagePlus size={16} /></div>
      )}
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
        {statusLabel(post.status)}
      </span>
      <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-gray-400">
        {showDate
          ? fmt(post.scheduled_for)
          : new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}
      </span>
      <span className="flex-1 truncate text-sm text-slate-700 dark:text-gray-200">{post.body}</span>
      {(post.post_targets || []).length > 0 && (
        <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">
          {post.post_targets.length} page{post.post_targets.length !== 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}
