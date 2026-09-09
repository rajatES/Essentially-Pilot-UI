"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldOff, Ban, CloudOff, Clock, HelpCircle } from "lucide-react";
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
    hint: "Postiz's own hosting failed to respond, so the post never reached the platform. Nothing retries these — re-send them.",
  },
  {
    id: "rejected",
    label: "Platform rejected",
    icon: Ban,
    test: /reported this post as failed|rejected/i,
    hint: "Postiz accepted the post, then the platform refused to publish it.",
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

export default function FailureList({ failures, days, truncated, error, onOpenPost, postsById }) {
  const [activeClass, setActiveClass] = useState("all");

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

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {failures.length
              ? "Nothing matches the current filters."
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

                {post && (
                  <button
                    onClick={() => onOpenPost(post)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <ExternalLink size={11} /> Open post
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
