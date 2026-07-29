"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, History, Pencil, RefreshCw, ShieldCheck, Trash2, Webhook, X, XCircle } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { externalPostUrl } from "@/lib/fbLink";
import { STATUS_STYLES, statusLabel, fmt, PlatformIcon } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsInvalidate } from "@/lib/queries";

// Live "auto-approves in …" countdown for a pending post with a deadline.
function AutoApproveCountdown({ at }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(at).getTime() - now;
  if (ms <= 0) return <p className="text-xs text-amber-700 dark:text-amber-300">Auto-approving shortly…</p>;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  return <p className="text-xs text-amber-700 dark:text-amber-300">⏱ Auto-approves in {label} unless reviewed first.</p>;
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// Post detail drawer (view + edit + approval actions), extracted from
// app/app/page.js. `post` is the row to show; owns its own edit state and
// mutations, refreshing the shared ["posts"] cache afterwards.
export default function PostDetailDrawer({ post: initialPost, authors, me, apiKeys = [], onClose }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const qc = useQueryClient();
  const [post, setPost] = useState(initialPost);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); // guards approve/reject/submit/save from double-fire
  const [editDraft, setEditDraft] = useState({ body: "", linkUrl: "", scheduledFor: "" });
  const [reviewComment, setReviewComment] = useState("");

  // Approval audit trail for this post (who submitted/approved/rejected + notes).
  const { data: historyData } = useQuery({
    queryKey: ["approvals", post.id],
    queryFn: () => apiJson(`/api/approvals?postId=${post.id}`),
    enabled: !!post.id,
  });
  const history = historyData?.approvals || [];

  function startEdit() {
    setEditDraft({
      body: post.body || "",
      linkUrl: post.link_url || "",
      scheduledFor: post.status === "scheduled" ? toLocalInput(post.scheduled_for) : ""
    });
    setEditing(true);
  }

  async function savePostEdit() {
    try {
      const payload = { body: editDraft.body, linkUrl: editDraft.linkUrl || null };
      if (post.status === "scheduled" && editDraft.scheduledFor) {
        payload.scheduledFor = editDraft.scheduledFor;
      }
      const r = await apiJson(`/api/posts/${post.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setPost(r.post);
      setEditing(false);
      showToast(r.warning ? `Saved — Facebook note: ${r.warning}` : "Post updated.", r.warning ? "warn" : "ok");
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Approve / reject / (re)submit a post in the review workflow.
  // `override` forces past a fact-check block/flag ("Approve anyway").
  async function reviewPost(action, override = false) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiJson("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          postId: post.id,
          action,
          override,
          comment: reviewComment.trim() || null,
          reviewer: me?.display_name || "You",
        }),
      });
      setPost(r.post);
      setReviewComment("");
      if (action === "approve") {
        if (r.held) {
          showToast(`Held by fact-check (${r.factCheck?.action}) — review the note, then Approve anyway if it's fine.`, "warn");
        } else {
          const ok = r.post.status === "sent" || r.post.status === "scheduled";
          showToast(r.warning ? `Approved — ${r.warning}` : ok ? `Approved and ${r.post.status === "sent" ? "published" : "scheduled"}.` : "Approved, but it failed on every page — check Posts for details.", ok && !r.warning ? "ok" : "warn");
        }
      } else if (action === "reject") {
        showToast("Post rejected.", "warn");
      } else {
        showToast("Submitted for review.");
      }
      qc.invalidateQueries({ queryKey: ["approvals", post.id] });
      invalidatePosts();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    try {
      await apiJson(`/api/posts/${post.id}`, { method: "DELETE" });
      showToast("Post deleted.");
      invalidatePosts();
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
          <p className="font-semibold text-slate-800 dark:text-white">{editing ? "Edit post" : "Post details"}</p>
          <div className="flex items-center gap-1">
            {!editing && post.status !== "sent" && post.status !== "publishing" && (
              <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                <Pencil size={13} /> Edit
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800">
              <X size={18} />
            </button>
          </div>
        </div>

        {editing ? (
          /* EDIT MODE */
          <div className="p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Caption &amp; hashtags</label>
              <textarea
                value={editDraft.body}
                onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                rows={7}
                maxLength={5000}
                className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Link</label>
              <input
                type="url"
                value={editDraft.linkUrl}
                onChange={(e) => setEditDraft((d) => ({ ...d, linkUrl: e.target.value }))}
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            {post.status === "scheduled" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Schedule time</label>
                <input
                  type="datetime-local"
                  value={editDraft.scheduledFor}
                  onChange={(e) => setEditDraft((d) => ({ ...d, scheduledFor: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">Caption &amp; time changes are pushed to Facebook too. (Image can&apos;t be changed on a scheduled post.)</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                Cancel
              </button>
              <button onClick={savePostEdit} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                <CheckCircle2 size={15} /> Save changes
              </button>
            </div>
          </div>
        ) : (
          /* VIEW MODE */
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
                {statusLabel(post.status)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
                <Clock size={12} /> {fmt(post.scheduled_for)}
              </span>
              {authors.find((a) => a.id === post.created_by) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                  Posted by {authors.find((a) => a.id === post.created_by)?.display_name}
                </span>
              )}
            </div>

            {/* How this post was created — API (with the key), CSV, or recycle.
                "app" posts show nothing (the default, unremarkable case). */}
            {(() => {
              const src = post.source || "app";
              if (src === "app") return null;
              if (src === "api") {
                const key = apiKeys.find((k) => k.id === post.api_key_id);
                return (
                  <div className="flex items-start gap-2 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-2.5 text-xs text-violet-700 dark:text-violet-300">
                    <Webhook size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Created via the <strong>Developer API</strong>
                      {key ? (
                        <> · key <strong>{key.name}</strong> <code className="text-[11px]">{key.key_prefix}</code>{key.revoked_at ? " (revoked)" : ""}</>
                      ) : post.api_key_id ? (
                        <> · key removed</>
                      ) : null}
                    </span>
                  </div>
                );
              }
              const meta = src === "csv"
                ? { Icon: FileText, label: "Imported from a CSV upload" }
                : { Icon: RefreshCw, label: "Recycled from another post" };
              const Icon = meta.Icon;
              return (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/40 p-2.5 text-xs text-slate-600 dark:text-gray-300">
                  <Icon size={14} className="shrink-0" /> {meta.label}
                </div>
              );
            })()}

            {post.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.image_url} alt="" className="w-full rounded-lg border border-slate-200 dark:border-gray-800 object-cover" />
            )}

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-gray-200">{post.body}</p>

            {post.link_url && (
              <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline break-all">
                <ExternalLink size={13} /> {post.link_url}
              </a>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Target pages</p>
              <div className="space-y-2">
                {(post.post_targets || []).map((t) => {
                  const url = externalPostUrl(t.social_accounts?.platform || t.platform, t.external_post_id);
                  return (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-gray-800 p-2.5">
                      <PlatformIcon platform={t.social_accounts?.platform || t.platform} size={15} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{t.social_accounts?.display_name || "Page"}</p>
                        <p className="text-xs capitalize text-slate-500 dark:text-gray-400">{t.status}</p>
                      </div>
                      {t.status === "sent" && url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                          <ExternalLink size={12} /> View
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {post.last_error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">{post.last_error}</p>
            )}

            {/* Approval workflow — approve/reject is restricted to admins,
                or a Group Head reviewing their own division's posts. */}
            {post.status === "pending_review" && (() => {
              const authorDivisionId = authors.find((a) => a.id === post.created_by)?.division_id;
              const canReview = me?.role === "admin" || (me?.is_group_head && authorDivisionId && authorDivisionId === me?.division_id);
              const fc = post.fact_check;
              const flagged = fc && (fc.action === "block" || fc.action === "flag") && !fc.overridden;
              return (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Pending review — won&apos;t go out until approved</p>
                  {post.auto_approve_at && <AutoApproveCountdown at={post.auto_approve_at} />}

                  {flagged && (
                    <div className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${fc.action === "block" ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" : "border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300"}`}>
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        <strong>{fc.action === "block" ? "Fact-check blocked" : "Fact-check flagged"}:</strong> {fc.reason || "needs a human review."}
                      </span>
                    </div>
                  )}

                  {canReview ? (
                    <>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={2}
                        placeholder="Feedback (optional) — saved to the approval history"
                        className="w-full resize-none rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => reviewPost("approve", flagged)} disabled={busy}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${flagged ? "bg-orange-600 hover:bg-orange-700" : "bg-teal-600 hover:bg-teal-700"}`}>
                          <CheckCircle2 size={14} /> {flagged ? "Approve anyway" : "Approve & publish"}
                        </button>
                        <button onClick={() => reviewPost("reject")} disabled={busy}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">Tip: use <strong>Edit</strong> (top-right) to tweak the caption before approving.</p>
                    </>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">Only an admin or this post&apos;s division Group Head can approve/reject it.</p>
                  )}
                </div>
              );
            })()}

            {(post.status === "rejected" || post.status === "draft") && (
              <button onClick={() => reviewPost("submit")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20">
                <ShieldCheck size={14} /> {post.status === "rejected" ? "Resubmit for review" : "Submit for review"}
              </button>
            )}

            {history.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
                  <History size={12} /> Approval history
                </p>
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-lg border border-slate-100 dark:border-gray-800 px-2.5 py-1.5">
                      <p className="text-xs text-slate-600 dark:text-gray-300">
                        <span className="font-semibold capitalize text-slate-800 dark:text-white">{h.action}</span>
                        {h.reviewer ? ` by ${h.reviewer}` : ""} · {fmt(h.created_at)}
                      </p>
                      {h.comment && <p className="mt-0.5 text-xs italic text-slate-500 dark:text-gray-400">“{h.comment}”</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(post.status === "scheduled" || post.status === "failed" || post.status === "draft" || post.status === "rejected" || post.status === "approved" || post.status === "pending_review") && (
              <button
                onClick={deletePost}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 size={15} /> Delete post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
