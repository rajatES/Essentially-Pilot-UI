"use client";

import { ExternalLink } from "lucide-react";
import { externalPostUrl } from "@/lib/fbLink";

// "Open the published post on the platform" — one affordance, used everywhere a
// published post is listed (Posts, the post drawer, Post Analytics, Dashboard
// top posts) so the icon means the same thing in all of them.
//
// The interesting part is the DISABLED case. Whether a link exists depends on
// the platform and on how far the post has got, and each reason needs a
// different answer from the reader:
//
//   - not published yet          → nothing to open; wait or check the queue
//   - Facebook / X / YouTube     → the URL is derived from the id, so a live
//                                  post always has one
//   - Instagram / Threads        → the id maps to NO public URL. The link only
//                                  exists because Postiz reports a `releaseURL`
//                                  which `reconcilePostizTarget` stores on
//                                  post_targets.permalink — and that happens on
//                                  the verify-posts cron, not at publish time.
//                                  So a just-published Threads post genuinely
//                                  has no link yet, and saying "no public link"
//                                  would read as "never will have".
//
// A greyed icon with no explanation makes all three look like the same bug, so
// each gets its own tooltip.

// Platforms whose permalink can be derived from the external id alone.
const DERIVABLE = new Set(["facebook", "twitter", "youtube"]);

export function viewPostUnavailableReason({ platform, externalPostId, status }) {
  if (status && !["sent", "deleted"].includes(status)) return "Not published yet — nothing to open.";
  if (!externalPostId) return "No post id was recorded, so this can't be opened.";
  if (String(externalPostId).includes("_mock_")) return "Published in mock mode — no real post exists.";
  if (!DERIVABLE.has(platform)) {
    return "Instagram and Threads ids have no public URL. The link appears once the verify job confirms the post with Postiz — usually within a few hours of publishing.";
  }
  return "No public link for this post.";
}

// Pick the one target of a fanned-out post that should back its single "open"
// link. A post can go to dozens of pages, so there is no single "the" post on
// the platform — this answers "see this live somewhere".
//
// The test is whether a URL can actually be BUILT, not whether a permalink was
// stored. Those differ: a Facebook or X target resolves from its id with no
// permalink at all, while a Threads target without one never resolves. An
// earlier version preferred "has a permalink", which picked the unlinkable
// Threads page of a Threads+Facebook post and left it looking unopenable.
//
// Falls back to the first real target when none resolve, so the row still shows
// a greyed icon carrying the reason rather than nothing at all.
//
// dashboard.service.ts applies the same rule server-side, where the aggregation
// happens before the frontend ever sees the targets.
export function pickViewableTarget(targets) {
  let fallback = null;
  for (const t of targets || []) {
    const id = t.externalPostId ?? t.external_post_id;
    if (!id || String(id).includes("_mock_")) continue;
    const candidate = { platform: t.platform, externalPostId: id, permalink: t.permalink || null };
    if (externalPostUrl(candidate.platform, candidate.externalPostId, candidate.permalink)) return candidate;
    if (!fallback) fallback = candidate;
  }
  return fallback;
}

export default function ViewPostLink({
  platform,
  externalPostId,
  permalink,
  status,
  label,
  size = 13,
  className = "",
}) {
  const url = externalPostUrl(platform, externalPostId, permalink);

  if (!url) {
    return (
      <span
        title={viewPostUnavailableReason({ platform, externalPostId, status })}
        aria-disabled="true"
        className={`inline-flex cursor-not-allowed items-center gap-1 text-slate-300 dark:text-gray-700 ${className}`}
      >
        <ExternalLink size={size} className="shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      // Every caller sits inside something clickable (a post card, a table row,
      // a drawer trigger). Without this the click opens the tab AND the row.
      onClick={(e) => e.stopPropagation()}
      title={`Open this post on ${platform === "twitter" ? "X" : platform} in a new tab`}
      // Accent-coloured, not grey. The disabled variant above is grey, and the
      // two were originally slate-400 vs slate-300 — indistinguishable in a row
      // of chips, so a reader could not tell which posts they could actually
      // open. Whether the link works is the single most useful thing this
      // element communicates, so it gets a colour difference, not a shade one.
      className={`inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 ${className}`}
    >
      <ExternalLink size={size} className="shrink-0" />
      {label}
    </a>
  );
}
