"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, Table2, LayoutGrid, Download, RefreshCw, DownloadCloud, Columns3, Search, X,
  ChevronDown, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Info, MoreHorizontal,
  ExternalLink, Image as ImageIcon, Video, Link2, FileText,
} from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { usePostAnalytics, usePostsData } from "@/lib/queries";
import { PLATFORM_META, PlatformIcon, sourceBadge } from "@/lib/platformMeta";
import { externalPostUrl } from "@/lib/fbLink";
import { useToast } from "@/components/common/ToastProvider";
import {
  COLUMN_BY_KEY, DEFAULT_VISIBLE, cellValue, formatCell, sortValue, compactNum, contentLabel,
} from "@/lib/postAnalyticsColumns";
import CustomiseColumnsModal from "./CustomiseColumnsModal";

const LS_KEY = "pp.postAnalytics.columns.v1";
const DATE_PRESETS = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 3 months"], ["custom", "Custom range"]];
const TYPE_OPTIONS = [["all", "All types"], ["video", "Video"], ["photo", "Photo"], ["link", "Link"], ["text", "Text only"]];

function loadColumns() {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved.filter((k) => COLUMN_BY_KEY[k]);
  } catch { /* ignore */ }
  return DEFAULT_VISIBLE;
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PostAnalyticsView() {
  const qc = useQueryClient();
  const showToast = useToast();

  const [preset, setPreset] = useState("30");
  const initEnd = localDate(new Date());
  const initStart = localDate(new Date(Date.now() - 30 * 86400000));
  const [start, setStart] = useState(initStart);
  const [end, setEnd] = useState(initEnd);

  const [viewMode, setViewMode] = useState("list");
  const [pageFilter, setPageFilter] = useState([]); // accountIds
  const [platformFilter, setPlatformFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all"); // all | app | organic
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "datePublished", dir: "desc" });
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const pageDropdownRef = useRef(null);

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  useEffect(() => { setVisibleColumns(loadColumns()); }, []);
  function applyColumns(next) {
    setVisibleColumns(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const perPage = viewMode === "grid" ? 24 : 30;

  const queryArg = preset === "custom" ? { start, end } : { days: Number(preset) };
  const { data, isLoading } = usePostAnalytics(queryArg);
  const { data: postsData } = usePostsData();
  const accounts = useMemo(() => postsData?.accounts || [], [postsData]);

  const rows = useMemo(() => data?.rows || [], [data]);

  // Close the page dropdown on outside click.
  useEffect(() => {
    function onClick(e) {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(e.target)) {
        setPageDropdownOpen(false);
        setPageSearch("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => { setPage(1); }, [pageFilter, platformFilter, typeFilter, originFilter, search, sort, viewMode, preset, start, end]);

  function handlePreset(v) {
    setPreset(v);
    if (v !== "custom") {
      setEnd(localDate(new Date()));
      setStart(localDate(new Date(Date.now() - Number(v) * 86400000)));
    }
  }

  const platformsInUse = useMemo(() => [...new Set(rows.map((r) => r.platform))], [rows]);
  const accountsForFilter = useMemo(() => {
    // Prefer accounts that actually appear in the data; fall back to all connected.
    const idsInData = new Set(rows.map((r) => r.accountId).filter(Boolean));
    const fromData = accounts.filter((a) => idsInData.has(a.id));
    return (fromData.length ? fromData : accounts);
  }, [accounts, rows]);
  const filteredDropdownAccounts = accountsForFilter.filter((a) =>
    a.display_name.toLowerCase().includes(pageSearch.toLowerCase()),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pageSet = new Set(pageFilter);
    const list = rows.filter((r) => {
      if (pageSet.size && !pageSet.has(r.accountId)) return false;
      if (platformFilter !== "all" && r.platform !== platformFilter) return false;
      if (typeFilter !== "all" && r.postType !== typeFilter) return false;
      if (originFilter !== "all" && (r.origin || "app") !== originFilter) return false;
      if (q && !(r.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
    const col = COLUMN_BY_KEY[sort.key] || COLUMN_BY_KEY.datePublished;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sortValue(col.kind, cellValue(a, col.key));
      const bv = sortValue(col.kind, cellValue(b, col.key));
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, pageFilter, platformFilter, typeFilter, originFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const startIdx = (page - 1) * perPage;
  const pageRows = filtered.slice(startIdx, startIdx + perPage);

  const cols = visibleColumns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }
  function togglePage(id) {
    setPageFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function clearFilters() {
    setPageFilter([]); setPlatformFilter("all"); setTypeFilter("all"); setOriginFilter("all"); setSearch("");
  }

  // Pull ALL posts (organic + app) from connected FB/IG pages into the DB, then
  // reload. Admin-only server-side — a non-admin gets a clear error toast.
  async function syncFromPlatforms() {
    setSyncing(true);
    try {
      const body = preset === "custom" ? { start, end } : { days: Number(preset) };
      const r = await apiJson("/api/insights/sync", { method: "POST", body: JSON.stringify(body) });
      qc.invalidateQueries({ queryKey: ["post-analytics"] });
      showToast(`Synced ${r.synced} post(s) from ${r.accounts} page(s)${r.failed ? `, ${r.failed} failed` : ""}.`, r.failed ? "warn" : "ok");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  }

  async function refreshInsights() {
    setRefreshing(true);
    try {
      // Refresh the same window the table is showing, so older posts get their
      // metrics pulled too (not just the last 30 days).
      const rangeBody = preset === "custom" ? { start, end } : { days: Number(preset) };
      const r = await apiJson("/api/insights/refresh", { method: "POST", body: JSON.stringify(rangeBody) });
      qc.invalidateQueries({ queryKey: ["post-analytics"] });
      showToast(`Refreshed ${r.synced} post target(s)${r.failed ? `, ${r.failed} failed` : ""}.`, r.failed ? "warn" : "ok");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRefreshing(false);
    }
  }

  function exportCsv() {
    if (!filtered.length) return;
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // Post identity (from the fixed title block) leads every export, then the
    // currently-visible metric columns.
    const idHeaders = ["Page", "Platform", "Type", "Title", "Permalink"];
    const headers = [...idHeaders, ...cols.map((c) => c.label)];
    const lines = [headers.map(esc).join(",")];
    for (const r of filtered) {
      const idVals = [
        r.page, r.platform, contentLabel(r), r.title,
        (r.externalPostId && externalPostUrl(r.platform, r.externalPostId)) || "",
      ];
      const metricVals = cols.map((c) => {
        const v = cellValue(r, c.key);
        if (c.kind === "date") return v ? new Date(v).toISOString() : "";
        if (["num", "pct", "duration", "durationAvg"].includes(c.kind)) return v == null ? "" : v;
        return v;
      });
      lines.push([...idVals, ...metricVals].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `post_analytics_${preset === "custom" ? `${start}_to_${end}` : `last_${preset}d`}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const activeFilters = pageFilter.length || platformFilter !== "all" || typeFilter !== "all" || originFilter !== "all" || search;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <BarChart3 size={20} /> Post Analytics
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Per-post performance across your pages. Metrics fetched from each platform by post ID.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={preset} onChange={(e) => handlePreset(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 outline-none focus:border-indigo-500">
            {DATE_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {preset === "custom" && (
            <>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-slate-700 dark:text-gray-200 outline-none" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-slate-700 dark:text-gray-200 outline-none" />
            </>
          )}
          <button onClick={syncFromPlatforms} disabled={syncing}
            title="Pull ALL posts (organic + app-made) from your connected Facebook / Instagram pages"
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50">
            <DownloadCloud size={15} className={syncing ? "animate-pulse" : ""} /> {syncing ? "Syncing…" : "Sync"}
          </button>
          <button onClick={refreshInsights} disabled={refreshing} title="Re-pull metrics for posts already in the table"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
        {/* Page multi-select */}
        <div ref={pageDropdownRef} className="relative">
          <button onClick={() => setPageDropdownOpen((o) => !o)}
            className="flex min-w-[160px] items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-gray-200">
            <span className="truncate">
              {pageFilter.length === 0 ? "All pages"
                : pageFilter.length === 1 ? (accountsForFilter.find((a) => a.id === pageFilter[0])?.display_name || "1 page")
                : `${pageFilter.length} pages`}
            </span>
            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${pageDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {pageDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
              <div className="border-b border-slate-100 dark:border-gray-800 p-2">
                <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-gray-800 px-2 py-1.5">
                  <Search size={13} className="text-slate-400" />
                  <input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search pages…" autoFocus
                    className="w-full bg-transparent text-sm outline-none dark:text-gray-200" />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filteredDropdownAccounts.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs text-slate-400">No pages</p>
                ) : filteredDropdownAccounts.map((a) => (
                  <button key={a.id} onClick={() => togglePage(a.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-gray-800">
                    <input type="checkbox" readOnly checked={pageFilter.includes(a.id)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
                    <PlatformIcon platform={a.platform} size={13} />
                    <span className="truncate text-slate-700 dark:text-gray-200">{a.display_name}</span>
                  </button>
                ))}
              </div>
              {pageFilter.length > 0 && (
                <div className="border-t border-slate-100 dark:border-gray-800 p-2">
                  <button onClick={() => setPageFilter([])} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Clear pages</button>
                </div>
              )}
            </div>
          )}
        </div>

        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-slate-700 dark:text-gray-200 outline-none">
          <option value="all">All platforms</option>
          {platformsInUse.map((p) => <option key={p} value={p}>{PLATFORM_META[p]?.label || p}</option>)}
        </select>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-slate-700 dark:text-gray-200 outline-none">
          {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} title="Posted via this app vs. directly on the platform"
          className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-slate-700 dark:text-gray-200 outline-none">
          <option value="all">App + Organic</option>
          <option value="app">App-made</option>
          <option value="organic">Organic</option>
        </select>

        <div className="flex min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
          <Search size={13} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions…"
            className="w-full bg-transparent text-sm outline-none dark:text-gray-200" />
          {search && <button onClick={() => setSearch("")}><X size={12} className="text-slate-400" /></button>}
        </div>

        {activeFilters ? (
          <button onClick={clearFilters} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Clear</button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowCustomise(true)} title="Customise columns"
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50">
            <Columns3 size={16} />
          </button>
          <button onClick={exportCsv} title="Export CSV"
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50">
            <Download size={16} />
          </button>
          <div className="flex rounded-lg border border-slate-200 dark:border-gray-800 p-0.5">
            <button onClick={() => setViewMode("list")} title="Table"
              className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-400"}`}>
              <Table2 size={16} />
            </button>
            <button onClick={() => setViewMode("grid")} title="Grid"
              className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-slate-400"}`}>
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      <p className="px-1 text-xs text-slate-500 dark:text-gray-400">
        {filtered.length.toLocaleString()} row{filtered.length === 1 ? "" : "s"} (one per post × page)
      </p>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-16 text-center shadow-sm">
          <BarChart3 size={32} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No published posts in this range</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Publish posts, then hit <strong>Refresh</strong> to pull their metrics.</p>
        </div>
      ) : viewMode === "list" ? (
        <PostTable rows={pageRows} cols={cols} sort={sort} onSort={toggleSort} />
      ) : (
        <PostGrid rows={pageRows} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm">
          <span className="text-sm text-slate-500 dark:text-gray-400">
            {startIdx + 1}–{Math.min(startIdx + perPage, filtered.length)} of {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 disabled:opacity-40">
              <ChevronLeft size={15} /> Prev
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">Page {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 disabled:opacity-40">
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {showCustomise && (
        <CustomiseColumnsModal visible={visibleColumns} onApply={applyColumns} onClose={() => setShowCustomise(false)} />
      )}
    </div>
  );
}

// ── Table view (Meta Business Suite–style: sticky title/actions + scrolling metrics) ──
const alignCls = (a) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
const TYPE_ICON = { video: Video, photo: ImageIcon, link: Link2, text: FileText };

function PostTable({ rows, cols, sort, onSort }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
            <tr>
              <th className="sticky left-0 z-20 min-w-[460px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800">
                Title
              </th>
              {cols.map((c) => (
                <th key={c.key} className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800 ${alignCls(c.align)}`}>
                  <button onClick={() => onSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-gray-200 ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                    <span>{c.label}</span>
                    {c.desc && (
                      <span title={c.desc} className="inline-flex cursor-help text-slate-300 dark:text-gray-600">
                        <Info size={11} />
                      </span>
                    )}
                    {sort.key === c.key
                      ? (sort.dir === "desc" ? <ArrowDown size={11} className="text-indigo-500" /> : <ArrowUp size={11} className="text-indigo-500" />)
                      : <ArrowUpDown size={11} className="opacity-30" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowId} className="group">
                <td className="sticky left-0 z-10 min-w-[460px] border-b border-r border-slate-100 bg-white px-4 py-3 group-hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:group-hover:bg-gray-800/40">
                  <TitleCell row={r} />
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap border-b border-slate-100 px-4 py-3 group-hover:bg-slate-50 dark:border-gray-800 dark:group-hover:bg-gray-800/40 ${alignCls(c.align)}`}>
                    {renderMetric(r, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderMetric(row, col) {
  const display = formatCell(col.kind, cellValue(row, col.key));
  if (display === "—") return <span className="text-slate-300 dark:text-gray-600">—</span>;
  const cls = col.key === "datePublished" ? "text-slate-600 dark:text-gray-300" : "font-medium text-slate-700 dark:text-gray-200";
  return <span className={cls}>{display}</span>;
}

// Fixed identity block: thumbnail + platform badge, caption, and a
// type · page sub-line — plus the per-row View / ⋯ actions.
function TitleCell({ row }) {
  const url = row.externalPostId ? externalPostUrl(row.platform, row.externalPostId) : null;
  const TIcon = TYPE_ICON[row.postType] || FileText;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        {row.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={row.thumbnailUrl} alt="" className="h-11 w-11 rounded-md border border-slate-200 object-cover dark:border-gray-800" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-300 dark:bg-gray-800 dark:text-gray-600"><ImageIcon size={18} /></div>
        )}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-sm dark:bg-gray-900"><PlatformIcon platform={row.platform} size={11} /></span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="max-w-[240px] truncate text-sm font-medium text-slate-800 dark:text-white" title={row.title}>
          {row.title || <span className="italic text-slate-400">No caption</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
          <TIcon size={12} className="shrink-0" />
          <span>{contentLabel(row)}</span>
          <span className="text-slate-300 dark:text-gray-600">·</span>
          <span className="max-w-[120px] truncate">{row.page}</span>
          {row.origin === "organic" ? (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-gray-800 dark:text-gray-400">Organic</span>
          ) : sourceBadge(row.source) ? (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadge(row.source).cls}`}>{sourceBadge(row.source).label}</span>
          ) : null}
        </p>
      </div>
      <RowActions row={row} url={url} />
    </div>
  );
}

// View link + a ⋯ menu (copy caption / post ID). The menu is fixed-positioned
// so it isn't clipped by the table's horizontal-scroll container.
function RowActions({ row, url }) {
  const [menu, setMenu] = useState(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", close);
    };
  }, [menu]);

  const copy = (text) => { try { navigator.clipboard.writeText(text || ""); } catch { /* clipboard unavailable */ } setMenu(null); };
  const openMenu = (e) => {
    e.stopPropagation();
    const r = btnRef.current.getBoundingClientRect();
    setMenu({ x: r.right, y: r.bottom + 4 });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          View
        </a>
      ) : (
        <span title="No public link for this platform"
          className="cursor-not-allowed rounded-lg border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-300 dark:border-gray-800 dark:text-gray-600">
          View
        </span>
      )}
      <button ref={btnRef} onClick={openMenu} title="More"
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
        <MoreHorizontal size={15} />
      </button>
      {menu && (
        <div style={{ position: "fixed", top: menu.y, left: menu.x - 176, zIndex: 60 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <button onClick={() => copy(row.title)} className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-800">Copy caption</button>
          <button onClick={() => copy(row.externalPostId)} className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-800">Copy post ID</button>
        </div>
      )}
    </div>
  );
}

// ── Grid view (ES Studio-style cards, fixed key metrics) ──────────────────────
function PostGrid({ rows }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => {
        const m = r.metrics || {};
        const url = r.externalPostId ? externalPostUrl(r.platform, r.externalPostId) : null;
        return (
          <div key={r.rowId}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:border-slate-300 dark:hover:border-gray-700">
            <div className="flex items-center gap-2 px-3 pt-3">
              <PlatformIcon platform={r.platform} size={14} />
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-white">{r.page}</span>
              <span className="ml-auto text-[11px] text-slate-400 dark:text-gray-500">{formatCell("date", r.datePublished)}</span>
            </div>
            <div className="px-3 pt-2">
              <p className="line-clamp-2 min-h-[2.5rem] text-xs text-slate-600 dark:text-gray-300">{r.title || <span className="italic text-slate-400">No caption</span>}</p>
            </div>
            <div className="mt-2 aspect-video bg-slate-100 dark:bg-gray-800">
              {r.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300 dark:text-gray-600"><ImageIcon size={26} /></div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-gray-800 text-center">
              <Stat label="Reach" value={m.reach} />
              <Stat label="Views" value={m.views} />
              <Stat label="Interactions" value={m.interactions} />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500 dark:text-gray-400">
              <span>{contentLabel(r)}</span>
              <span className="flex items-center gap-2">
                <span title="Likes">♥ {compactNum(m.likes) ?? "—"}</span>
                <span title="Comments">💬 {compactNum(m.comments) ?? "—"}</span>
                <span title="Shares">↗ {compactNum(m.shares) ?? "—"}</span>
                {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500"><ExternalLink size={13} /></a>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }) {
  const v = compactNum(value);
  return (
    <div className="bg-white dark:bg-gray-900 py-2">
      <p className="text-sm font-bold text-slate-800 dark:text-white">{v ?? "—"}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
