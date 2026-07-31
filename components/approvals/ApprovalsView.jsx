"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle, Webhook, Video, Image as ImageIcon,
  Link2, FileText, Inbox,
} from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { usePendingApprovals, usePostsInvalidate } from "@/lib/queries";
import { PlatformIcon, fmt } from "@/lib/platformMeta";
import AccountAvatar from "@/components/common/AccountAvatar";
import { useToast } from "@/components/common/ToastProvider";

const TYPE_ICON = { video: Video, photo: ImageIcon, link: Link2, text: FileText };

// Live "auto-approves in …" countdown for a page awaiting review.
function Countdown({ at }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(at).getTime() - now;
  if (ms <= 0) return <span className="text-amber-700 dark:text-amber-300">Auto-approving shortly…</span>;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  return <span className="text-amber-700 dark:text-amber-300">⏱ Auto-approves in {h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`}</span>;
}

// Page-grouped pending-approval queue (ES-registry style): a sidebar of pages
// each showing how many posts are waiting, and a detail pane where a reviewer
// approves/rejects each post FOR THAT PAGE independently.
export default function ApprovalsView({ me }) {
  const showToast = useToast();
  const qc = useQueryClient();
  const invalidatePosts = usePostsInvalidate();
  const { data, isLoading } = usePendingApprovals();
  const items = useMemo(() => data?.items || [], [data]);

  const [activePage, setActivePage] = useState(null); // accountId
  const [busyKey, setBusyKey] = useState(null); // `${postId}:${accountId}` while acting
  const [comments, setComments] = useState({}); // per-item feedback text

  // Group items by page (accountId), preserving a representative page header.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.accountId)) {
        map.set(it.accountId, {
          accountId: it.accountId,
          externalAccountId: it.externalAccountId,
          page: it.page,
          platform: it.platform,
          avatarUrl: it.avatarUrl,
          category: it.category,
          items: [],
        });
      }
      map.get(it.accountId).items.push(it);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  // Auto-select the first page that has pending items (once, when data lands or
  // the active page empties out after actions).
  useEffect(() => {
    if (!groups.length) { setActivePage(null); return; }
    if (!activePage || !groups.some((g) => g.accountId === activePage)) {
      setActivePage(groups[0].accountId);
    }
  }, [groups, activePage]);

  const current = groups.find((g) => g.accountId === activePage) || null;
  const totalPending = items.length;

  async function act(item, action) {
    const key = `${item.postId}:${item.accountId}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      const flagged = item.factCheck && (item.factCheck.action === "block" || item.factCheck.action === "flag") && !item.factCheck.overridden;
      const r = await apiJson("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          postId: item.postId,
          accountId: item.accountId,
          action,
          override: action === "approve" && flagged,
          comment: (comments[key] || "").trim() || null,
        }),
      });
      if (action === "approve" && r.held) {
        showToast(`Held by fact-check (${r.factCheck?.action}) — review the note, then Approve anyway.`, "warn");
      } else if (action === "approve") {
        showToast(`Approved for ${item.page}.`, r.warning ? "warn" : "ok");
      } else {
        showToast(`Rejected for ${item.page}.`, "warn");
      }
      qc.invalidateQueries({ queryKey: ["approvals-pending"] });
      invalidatePosts();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <ShieldCheck size={20} /> Approvals
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Posts awaiting review, grouped by page. Approve or reject each page independently.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {totalPending} pending {totalPending === 1 ? "item" : "items"} · {groups.length} {groups.length === 1 ? "page" : "pages"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : !groups.length ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-20 text-center shadow-sm">
          <Inbox size={34} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Nothing awaiting approval</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Posts submitted for review — from the composer or the Developer API — show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* ── Page sidebar ── */}
          <aside className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Pages ({groups.length})</p>
            <div className="max-h-[70vh] space-y-0.5 overflow-y-auto">
              {groups.map((g) => {
                const isActive = g.accountId === activePage;
                return (
                  <button key={g.accountId} onClick={() => setActivePage(g.accountId)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
                    }`}>
                    <AccountAvatar account={{ platform: g.platform, avatar_url: g.avatarUrl, external_account_id: g.externalAccountId }} size={26} />
                    <span className="min-w-0 flex-1 truncate font-medium">{g.page}</span>
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{g.items.length}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── Detail pane: selected page's pending posts ── */}
          <div className="space-y-3">
            {current && (
              <div className="flex items-center gap-2 px-1">
                <PlatformIcon platform={current.platform} size={16} />
                <h3 className="text-base font-semibold text-slate-800 dark:text-white">{current.page}</h3>
                <span className="text-sm text-slate-400 dark:text-gray-500">· {current.items.length} awaiting review</span>
              </div>
            )}
            {(current?.items || []).map((item) => {
              const key = `${item.postId}:${item.accountId}`;
              const TIcon = TYPE_ICON[item.mediaType] || FileText;
              const fc = item.factCheck;
              const flagged = fc && (fc.action === "block" || fc.action === "flag") && !fc.overridden;
              const busy = busyKey === key;
              return (
                <div key={key} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="flex gap-3">
                    {item.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-gray-800" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300 dark:bg-gray-800 dark:text-gray-600"><TIcon size={22} /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-gray-200 line-clamp-4">
                        {item.title || <span className="italic text-slate-400">No caption</span>}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1 capitalize"><TIcon size={12} /> {item.format || item.mediaType}</span>
                        {item.authorName && <><span className="text-slate-300 dark:text-gray-600">·</span><span>by {item.authorName}</span></>}
                        <span className="text-slate-300 dark:text-gray-600">·</span>
                        <span title={fmt(item.submittedAt)}>submitted {fmt(item.submittedAt)}</span>
                        {item.source === "api" && (
                          <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                            <Webhook size={11} /> API
                          </span>
                        )}
                      </div>
                      {item.autoApproveAt && (
                        <p className="mt-1 text-xs"><Countdown at={item.autoApproveAt} /></p>
                      )}
                    </div>
                  </div>

                  {flagged && (
                    <div className={`mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs ${fc.action === "block" ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300" : "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"}`}>
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span><strong>Fact-check {fc.action}:</strong> {fc.reason || "needs a human review."}</span>
                    </div>
                  )}

                  {item.canReview ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={comments[key] || ""}
                        onChange={(e) => setComments((c) => ({ ...c, [key]: e.target.value }))}
                        rows={2}
                        placeholder="Feedback (optional) — saved to the approval history"
                        className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => act(item, "approve")} disabled={busy}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${flagged ? "bg-orange-600 hover:bg-orange-700" : "bg-teal-600 hover:bg-teal-700"}`}>
                          <CheckCircle2 size={14} /> {flagged ? "Approve anyway" : "Approve"} for this page
                        </button>
                        <button onClick={() => act(item, "reject")} disabled={busy}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-500/10">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-slate-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                      Only an admin or this post&apos;s division Group Head can approve or reject it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
