"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldOff, Ban, CloudOff, Clock, HelpCircle, RotateCw, Loader2, EyeOff, Eye, Undo2, Pencil, X } from "lucide-react";
import { PLATFORM_META, PlatformIcon, fmt } from "@/lib/platformMeta";

// Failure classes, matched against the recorded error text.
//
// This is presentation only — the backend records whatever the failure path
// wrote and never drops a row it cannot classify. That matters: the whole point
// of this view is that NO failure is hidden, so an unrecognised message must
// still appear (as "Other"), never be filtered out. Order is significant; first
// match wins.
const CLASSES = [
  {
    id: "upstream",
    label: "Postiz down",
    icon: CloudOff,
    test: /Postiz server error|Couldn't reach Postiz|timed out/i,
    hint: "Postiz's own hosting failed to respond, so the post never reached the platform. Nothing retries these on its own — use Re-send.",
  },
  {
    id: "rejected",
    label: "Platform rejected",
    icon: Ban,
    test: /reported this post as failed|rejected/i,
    hint: "Postiz accepted the post, then the platform refused to publish it. Nothing went live, so these can be re-sent — usually worth editing the caption first, since the platform objected to what was in it.",
  },
  {
    id: "rate",
    label: "Rate limited",
    icon: Clock,
    test: /rate limit|\(429\)/i,
    hint: "The Postiz workspace create-post ceiling (~100/hour) was hit. Re-send once it clears.",
  },
  {
    id: "account",
    label: "Channel needs attention",
    icon: ShieldOff,
    test: /re-import|reconnect|locked|disabled in Postiz|no longer in the Postiz workspace|access token|missing its Postiz provider|\(401\)|\(403\)/i,
    hint: "The channel itself cannot publish. Fix the channel in Accounts before re-sending.",
  },
  {
    id: "stranded",
    label: "Interrupted",
    icon: AlertTriangle,
    test: /interrupted|stranded/i,
    hint: "Publishing died mid-flight, usually a backend restart. It may or may not have reached the platform — check the page before reposting.",
  },
  { id: "other", label: "Other", icon: HelpCircle, test: /.*/, hint: null },
];

const OTHER = CLASSES[CLASSES.length - 1];
const classify = (error) => CLASSES.find((c) => c.test.test(error || "")) || OTHER;

// A row can only be re-sent if we know which post it belongs to AND nothing is
// live behind it. A post id normally means the platform accepted it, so
// re-sending would publish a second copy — EXCEPT where the id belongs to a post
// we have since confirmed never published (the platform rejected it), which the
// server reports as rejectedByPlatform. See the same guard in
// posts.service.retry(), which is the one that actually enforces this. Here it
// only decides whether to offer the button, because a button that always errors
// is worse than no button.
const canRetry = (f) => !!f.postId && !!f.targetId && (!f.externalPostId || f.rejectedByPlatform);

export default function FailureList({
  failures,
  days,
  truncated,
  error,
  onOpenPost,
  postsById,
  onRetry,
  onClear,
  clearedCount = 0,
  showCleared = false,
  onToggleCleared,
}) {
  const [activeClass, setActiveClass] = useState("all");
  const [busy, setBusy] = useState(null); // targetId | "bulk"
  // The row being edited before it goes out again, or null. Holds its own draft
  // so cancelling leaves the failure exactly as it was.
  const [editRow, setEditRow] = useState(null);

  const counts = useMemo(() => {
    const map = {};
    for (const f of failures) {
      const id = classify(f.error).id;
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [failures]);

  const visible = useMemo(
    () => (activeClass === "all" ? failures : failures.filter((f) => classify(f.error).id === activeClass)),
    [failures, activeClass],
  );

  const activeHint = activeClass === "all" ? null : CLASSES.find((c) => c.id === activeClass)?.hint;

  const retryable = useMemo(() => visible.filter(canRetry), [visible]);

  // `edit` — { body, linkUrl } — is an optional change to send INSTEAD of what
  // the post currently says. Only ever passed for a single row: it is a caption
  // written for one failed page, and applying it across a filtered list would
  // rewrite posts nobody looked at.
  async function runRetry(rows, key, edit) {
    if (!onRetry || !rows.length) return;
    setBusy(key);
    try {
      return await onRetry(rows, edit);
    } finally {
      setBusy(null);
    }
  }

  async function runClear(args, key) {
    if (!onClear) return;
    setBusy(key);
    try {
      await onClear(args);
    } finally {
      setBusy(null);
    }
  }

  // A feed we could not load is NOT an empty feed. Without this branch a failed
  // request renders the empty state — "No failed deliveries" — which is the
  // most dangerous thing this component could say, and exactly the class of
  // silent false negative it was built to remove. It is also the live case
  // whenever the frontend deploys ahead of the backend that serves this route.
  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-center">
        <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Couldn&apos;t load the failure list.
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          This is not the same as having no failures — there may be failed posts this page cannot show
          right now. {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {truncated && (
        <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          This list hit its row cap, so there are older failures it is not showing. Narrow the date filter to reach them.
        </p>
      )}

      {/* The cleared-rows banner. This is NOT optional chrome: clearing hides
          real failures, so the one thing this view must never do is look empty
          while rows sit hidden. The count comes from the server (counted
          separately from the capped row query) and is shown to everyone, even
          viewers who lack permission to clear or restore. */}
      {clearedCount === null && (
        <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          Couldn&apos;t count cleared failures, so some may be hidden from this list. Use &ldquo;Show cleared&rdquo; to check.
        </p>
      )}

      {clearedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-3 py-2">
          <EyeOff size={13} className="text-slate-500 dark:text-gray-400" />
          <p className="text-xs text-slate-600 dark:text-gray-300">
            <span className="font-semibold">{clearedCount}</span> cleared{" "}
            {clearedCount === 1 ? "failure is" : "failures are"} hidden from this list. Nothing was deleted.
          </p>
          {onToggleCleared && (
            <button
              onClick={() => onToggleCleared(!showCleared)}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {showCleared ? <EyeOff size={11} /> : <Eye size={11} />}
              {showCleared ? "Hide cleared" : "Show cleared"}
            </button>
          )}
          {onClear && showCleared && (
            <button
              onClick={() => runClear({ all: true, restore: true }, "restore")}
              disabled={busy !== null}
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-gray-700 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === "restore" ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
              Restore all
            </button>
          )}
        </div>
      )}

      {/* Reason breakdown, which doubles as a filter. With 56 channels a bad
          hour produces dozens of rows that all share one cause, and seeing that
          at a glance is the difference between "something broke" and "Postiz was
          down for four minutes". */}
      {failures.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveClass("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              activeClass === "all"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
            }`}
          >
            All {failures.length}
          </button>
          {CLASSES.filter((c) => counts[c.id]).map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveClass(activeClass === c.id ? "all" : c.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                activeClass === c.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
              }`}
            >
              <c.icon size={11} /> {c.label} {counts[c.id]}
            </button>
          ))}
        </div>
      )}

      {activeHint && (
        <p className="rounded-lg bg-slate-50 dark:bg-gray-800/50 px-3 py-2 text-xs text-slate-600 dark:text-gray-400">
          {activeHint}
        </p>
      )}

      {/* Re-send everything currently listed. Scoped to the VISIBLE rows, not
          all failures, so the reason filter above doubles as the selection —
          "Postiz was down for four minutes" becomes one button press. Rows that
          already reached the platform are excluded from the count and the
          request; the wording says so rather than silently doing less than it
          appears to. */}
      {onRetry && retryable.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2">
          <RotateCw size={13} className="text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs text-indigo-900 dark:text-indigo-200">
            {retryable.length} of {visible.length} shown {visible.length === 1 ? "failure" : "failures"} can be re-sent.
            {retryable.length < visible.length && " The rest already reached the platform — open them and check the page."}
          </p>
          <button
            onClick={() => runRetry(retryable, "bulk")}
            disabled={busy !== null}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === "bulk" ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            {busy === "bulk" ? "Re-sending…" : `Re-send ${retryable.length}`}
          </button>
        </div>
      )}

      {/* Clear. Deliberately a quieter control than Re-send: fixing a failure is
          the better outcome, tidying it away is second best. Two scopes —
          exactly what the current filter shows, or the whole window — because
          "Postiz was down and left 200 rows" is the case that would otherwise
          push someone into deleting the posts themselves. */}
      {onClear && !showCleared && visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Dealt with these? Clearing hides them from this list — the posts and their errors are kept.
          </p>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => runClear({ rows: visible }, "clear-shown")}
              disabled={busy !== null}
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-gray-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === "clear-shown" ? <Loader2 size={11} className="animate-spin" /> : <EyeOff size={11} />}
              Clear {activeClass === "all" ? "all shown" : `these ${visible.length}`}
            </button>
            {activeClass !== "all" && (
              <button
                onClick={() => {
                  if (!confirm(`Clear every failure in the last ${days} days? Nothing is deleted — you can restore them.`)) return;
                  runClear({ all: true }, "clear-all");
                }}
                disabled={busy !== null}
                className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-gray-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {busy === "clear-all" ? <Loader2 size={11} className="animate-spin" /> : <EyeOff size={11} />}
                Clear all {failures.length}
              </button>
            )}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          {/* The wording here is load-bearing. "No failed deliveries" must only
              ever appear when that is literally true, so a window whose rows
              were all cleared says so instead — otherwise clearing would have
              turned this view into the false negative it exists to prevent. */}
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {failures.length
              ? "Nothing matches the current filters."
              : clearedCount === null
                ? `No open failures shown for the last ${days} days, but cleared ones could not be counted.`
                : clearedCount > 0
                  ? `No open failures in the last ${days} days — ${clearedCount} cleared ${clearedCount === 1 ? "one is" : "ones are"} hidden.`
                  : `No failed deliveries in the last ${days} days.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((f) => {
            const cls = classify(f.error);
            // The post may be older than /api/posts' 100-post window, in which
            // case there is nothing to open. The row still carries everything
            // that matters — that it is listed at all is the point.
            const post = f.postId ? postsById[f.postId] : null;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-l-[3px] border-slate-200 border-l-red-500 dark:border-gray-800 dark:border-l-red-500 bg-white dark:bg-gray-900 p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {/* suppressHydrationWarning because fmt() renders in the
                      viewer's locale and timezone: the server (UTC, Node ICU)
                      and the browser legitimately disagree, and without this
                      React logs a mismatch and re-renders the whole tree. */}
                  <span suppressHydrationWarning className="font-mono text-slate-500 dark:text-gray-400">
                    {f.when ? fmt(f.when) : "—"}
                  </span>
                  {f.channel ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-white">
                      {/* Guarded: the shared PlatformIcon falls back to a
                          Facebook glyph for an unknown platform, which would
                          mislabel the channel. No icon beats a wrong one. */}
                      {PLATFORM_META[f.platform] && <PlatformIcon platform={f.platform} size={12} />} {f.channel}
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-500 dark:text-gray-400">no page reached</span>
                  )}
                  {/* This page's caption was edited on an earlier re-send, so
                      what is shown below is that copy rather than the post's.
                      Without the badge the two would look identical while the
                      post card shows something else. */}
                  {f.edited && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                      edited for this page
                    </span>
                  )}
                  {f.publishVia === "postiz" && (
                    <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-gray-400">
                      via postiz
                    </span>
                  )}
                  {f.source && f.source !== "app" && (
                    <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-gray-400">
                      {f.source}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 font-semibold text-red-700 dark:text-red-400">
                    <cls.icon size={11} /> {cls.label}
                  </span>
                </div>

                <p className="mt-1.5 line-clamp-2 text-sm text-slate-700 dark:text-gray-200">
                  {f.body || <em className="text-slate-400 dark:text-gray-500">(no caption)</em>}
                </p>

                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{f.error}</p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {post && (
                    <button
                      onClick={() => onOpenPost(post)}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <ExternalLink size={11} /> Open post
                    </button>
                  )}

                  {onRetry &&
                    (canRetry(f) ? (
                      <>
                        <button
                          onClick={() => runRetry([f], f.targetId)}
                          disabled={busy !== null}
                          className="flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/30 px-2 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50"
                        >
                          {busy === f.targetId ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RotateCw size={11} />
                          )}
                          {busy === f.targetId ? "Re-sending…" : "Re-send"}
                        </button>
                        {/* Offered on every re-sendable row, not just the
                            rejected ones: a failure is often a failure OF the
                            content, and sending the identical caption back at
                            the platform that just refused it is the one retry
                            guaranteed to fail again. */}
                        <button
                          onClick={() => setEditRow(f)}
                          disabled={busy !== null}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-800 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
                        >
                          <Pencil size={11} /> Edit &amp; re-send
                        </button>
                      </>
                    ) : (
                      // No button, and a reason. The dangerous version of this
                      // row is one that looks re-sendable: this target already
                      // has a post id and nothing has confirmed the post failed
                      // to go live, so re-sending could publish a duplicate that
                      // nobody can take back.
                      f.externalPostId && (
                        <span className="text-xs text-slate-500 dark:text-gray-400">
                          Reached the platform — check the page before reposting.
                        </span>
                      )
                    ))}

                  {onClear &&
                    (f.clearedAt ? (
                      <button
                        onClick={() => runClear({ rows: [f], restore: true }, f.id)}
                        disabled={busy !== null}
                        className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                      >
                        {busy === f.id ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => runClear({ rows: [f] }, f.id)}
                        disabled={busy !== null}
                        className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                      >
                        {busy === f.id ? <Loader2 size={11} className="animate-spin" /> : <EyeOff size={11} />}
                        Clear
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editRow && (
        <EditRetryModal
          row={editRow}
          busy={busy === editRow.targetId}
          onCancel={() => setEditRow(null)}
          onSubmit={async (edit) => {
            // Kept open until the send actually goes through: closing first
            // would throw away a caption someone just wrote the moment the
            // request fails, which is exactly when they want it back.
            const ok = await runRetry([editRow], editRow.targetId, edit);
            if (ok !== false) setEditRow(null);
          }}
        />
      )}
    </div>
  );
}

// Edit one failed delivery, then send it again.
//
// The draft starts from what THIS page was actually going to publish — which is
// the post's caption unless a previous re-send already edited it for this page
// (the server resolves that; see failureRow). Re-offering the original after an
// edit would quietly undo the earlier one.
//
// The edit is deliberately scoped to this page. Where the post also published
// elsewhere the server keeps it as a per-page override rather than rewriting the
// post, so the pages that are already live keep the caption they are actually
// showing. The note below says so, because an editor that looks like it changes
// the post while changing one page would be worse than no editor.
function EditRetryModal({ row, busy, onCancel, onSubmit }) {
  const [body, setBody] = useState(row.body || "");
  const [linkUrl, setLinkUrl] = useState(row.linkUrl || "");
  const unchanged = body === (row.body || "") && linkUrl === (row.linkUrl || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onCancel}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-white">Edit &amp; re-send</p>
            <p className="truncate text-xs text-slate-500 dark:text-gray-400">
              {row.channel || "this page"}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {row.error}
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
              Caption &amp; hashtags
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              maxLength={5000}
              className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 bg-transparent px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
              Link
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-slate-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              Clearing this sends the caption with no link attached.
            </p>
          </div>

          <p className="rounded-lg bg-slate-50 dark:bg-gray-800/50 px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
            This changes what goes out to {row.channel || "this page"} only. Any page that already
            published this post keeps the caption it is showing.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              // Nothing touched → a plain re-send. Sending the identical text
              // back as an "edit" would pin it to this page as an override and
              // badge the row as edited, both for no change at all.
              onClick={() => onSubmit(unchanged ? undefined : { body: body.trim(), linkUrl: linkUrl.trim() || null })}
              disabled={busy || !body.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              title={!body.trim() ? "A caption is required." : undefined}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />}
              {busy ? "Re-sending…" : unchanged ? "Re-send unchanged" : "Save & re-send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
