"use client";

import { useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Pencil, ShieldCheck, Trash2, X, XCircle } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { externalPostUrl } from "@/lib/fbLink";
import { STATUS_STYLES, statusLabel, fmt, PlatformIcon } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsInvalidate } from "@/lib/queries";

function toLocalInput(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// Post detail drawer (view + edit + approval actions), extracted from
// app/app/page.js. `post` is the row to show; owns its own edit state and
// mutations, refreshing the shared ["posts"] cache afterwards.
export default function PostDetailDrawer({ post: initialPost, authors, me, onClose }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const [post, setPost] = useState(initialPost);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); // guards approve/reject/submit/save from double-fire
  const [editDraft, setEditDraft] = useState({ body: "", linkUrl: "", scheduledFor: "" });

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
  async function reviewPost(action) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiJson("/api/approvals", { method: "POST", body: JSON.stringify({ postId: post.id, action, reviewer: me?.display_name || "You" }) });
      setPost(r.post);
      if (action === "approve") {
        const ok = r.post.status === "sent" || r.post.status === "scheduled";
        showToast(r.warning ? `Approved — ${r.warning}` : ok ? `Approved and ${r.post.status === "sent" ? "published" : "scheduled"}.` : "Approved, but it failed on every page — check Posts for details.", ok && !r.warning ? "ok" : "warn");
      } else if (action === "reject") {
        showToast("Post rejected.", "warn");
      } else {
        showToast("Submitted for review.");
      }
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
              return (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                  <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Pending review — won't go out until approved</p>
                  {canReview ? (
                    <div className="flex gap-2">
                      <button onClick={() => reviewPost("approve")} disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                        <CheckCircle2 size={14} /> Approve &amp; publish
                      </button>
                      <button onClick={() => reviewPost("reject")} disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-300">Only an admin or this post's division Group Head can approve/reject it.</p>
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
