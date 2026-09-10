"use client";

import { Clock, Copy, ExternalLink, Trash2, XCircle } from "lucide-react";
import ViewPostLink from "@/components/common/ViewPostLink";
import { STATUS_STYLES, statusLabel, fmt, PlatformIcon, sourceBadge } from "@/lib/platformMeta";

// One post row in the Posts list. Extracted from app/app/page.js; target
// chips now show the real platform icon (was hardcoded to Facebook).
// `apiKeyName` (optional) labels the API badge with the creating key.
export default function PostCard({ post, author, onDelete, onOpen, onDuplicate, selected, onToggleSelect, apiKeyName }) {
  const targets = post.post_targets || [];
  const canDelete = post.status === "scheduled" || post.status === "failed";
  const srcBadge = sourceBadge(post.source);

  return (
    <article className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        {canDelete && onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
          />
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
              {statusLabel(post.status)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
              <Clock size={12} />
              {fmt(post.scheduled_for)}
            </span>
            {author && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                {author.display_name}
              </span>
            )}
            {srcBadge && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${srcBadge.cls}`}>
                {srcBadge.label}{post.source === "api" && apiKeyName ? ` · ${apiKeyName}` : ""}
              </span>
            )}
            {["reel", "story"].includes(post.platform_options?.facebook?.format) && (
              <span className="rounded-full bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-purple-700 dark:text-purple-300">
                FB {post.platform_options.facebook.format}
              </span>
            )}
            {post.platform_options?.instagram?.format === "reel" && (
              <span className="rounded-full bg-pink-50 dark:bg-pink-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-pink-700 dark:text-pink-300">
                IG reel
              </span>
            )}
            {/* One chip per page. A chip for a LIVE page carries an open-in-new-
                tab icon straight to the published post — the Posts list is where
                people actually look for a post, and until now the only way to
                reach the real thing was to open the drawer first. */}
            {targets.map((t) => {
              const platform = t.social_accounts?.platform || t.platform;
              return (
                <span key={t.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  t.status === "failed"
                    ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                    : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300"
                }`}>
                  <PlatformIcon platform={platform} size={10} />
                  {t.social_accounts?.display_name || "Page"}
                  {/* Only where there is something to open: a queued or failed
                      page has no live post, and a greyed icon on every chip of a
                      56-page fan-out would be noise rather than information. */}
                  {t.status === "sent" && (
                    <ViewPostLink
                      platform={platform}
                      externalPostId={t.external_post_id}
                      permalink={t.permalink}
                      status={t.status}
                      size={10}
                      className="-mr-0.5 ml-0.5"
                    />
                  )}
                </span>
              );
            })}
          </div>
          <p className="text-sm text-slate-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-3">
            {post.body}
          </p>
          {post.link_url && (
            <a
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate"
            >
              <ExternalLink size={11} />
              {post.link_url}
            </a>
          )}
          {post.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.image_url} alt="" className="mt-3 h-24 rounded-lg object-cover border border-slate-200 dark:border-gray-800" />
          )}
          {/* Per-page failures. Gated on the TARGET, not on post.status: a post
              that published to some pages and failed on others rolls up to
              "sent", and gating this on post.status === "failed" meant the only
              record of those failures was invisible in the UI. Threads fans out
              across ~27 Postiz channels, so that partial case is the norm. */}
          {targets.filter((t) => t.status === "failed" && t.last_error).map((t) => (
            <p key={t.id} className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
              <XCircle size={12} className="mt-0.5 shrink-0" />
              <span><strong>{t.social_accounts?.display_name}:</strong> {t.last_error}</span>
            </p>
          ))}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="rounded-lg p-2 text-slate-400 dark:text-gray-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Duplicate into composer"
            >
              <Copy size={16} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="rounded-lg p-2 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              title="Delete post"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
