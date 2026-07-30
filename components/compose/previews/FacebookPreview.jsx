"use client";

import { useState } from "react";
import { Globe, MessageCircle, MoreHorizontal, Play, Share2, ThumbsUp } from "lucide-react";
import AccountAvatar from "@/components/common/AccountAvatar";

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toUpperCase(); } catch { return ""; }
}

function Avatar({ account, size = 40 }) {
  return (
    <AccountAvatar
      account={account}
      size={size}
      fallback={
        <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {account?.display_name?.[0] || "P"}
        </div>
      }
    />
  );
}

function MediaGrid({ media }) {
  if (!media.length) return null;
  const Tile = ({ m, className = "", overlay = null }) => (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {m.type === "video" ? (
        <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-slate-800">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30"><Play size={22} className="ml-0.5 text-white" /></span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={m.url} alt="" className="h-full w-full object-cover" />
      )}
      {overlay}
    </div>
  );

  if (media.length === 1) return <Tile m={media[0]} className="max-h-[300px] w-full" />;
  if (media.length === 2) {
    return <div className="grid h-56 grid-cols-2 gap-0.5">{media.map((m, i) => <Tile key={i} m={m} />)}</div>;
  }
  if (media.length === 3) {
    return (
      <div className="grid h-64 grid-cols-2 gap-0.5">
        <Tile m={media[0]} className="row-span-2" />
        <Tile m={media[1]} />
        <Tile m={media[2]} />
      </div>
    );
  }
  const extra = media.length - 4;
  return (
    <div className="grid h-64 grid-cols-2 grid-rows-2 gap-0.5">
      {media.slice(0, 4).map((m, i) => (
        <Tile key={i} m={m}
          overlay={i === 3 && extra > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-bold text-white">+{extra}</div>
          ) : null}
        />
      ))}
    </div>
  );
}

// Facebook page-post preview card — mirrors the real FB feed card. `format`
// (post | reel | story) switches to the 9:16 Reel/Story frames.
export default function FacebookPreview({ account, caption, media, linkUrl, firstComment, format = "post" }) {
  const [expanded, setExpanded] = useState(false);
  const name = account?.display_name || "Your Page";
  const video = media.find((m) => m.type === "video");
  const first = media[0];

  if (format === "reel" || format === "story") {
    const src = format === "reel" ? video : first;
    return (
      <div className="mx-auto w-[240px] overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-800 bg-black shadow-sm">
        <div className="relative aspect-[9/16]">
          {src ? (
            src.type === "video" ? (
              <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/30"><Play size={26} className="ml-1 text-white" /></span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={src.url} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 text-xs text-white/60">
              {format === "reel" ? "Attach a video" : "Attach an image or video"}
            </div>
          )}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-2">
            <Avatar account={account} size={28} />
            <span className="text-xs font-semibold text-white drop-shadow">{name}</span>
          </div>
          {format === "reel" && caption && (
            <p className="absolute bottom-3 left-2.5 right-10 line-clamp-2 text-[11px] leading-snug text-white drop-shadow">{caption}</p>
          )}
          <span className="absolute right-2.5 top-2.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {format}
          </span>
        </div>
      </div>
    );
  }

  const long = caption && caption.length > 240;
  const shown = long && !expanded ? caption.slice(0, 240) : caption;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#242526] shadow-sm">
      {/* header */}
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <Avatar account={account} />
        <div className="flex-1 leading-tight">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-gray-100">{name}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400">Just now · <Globe size={11} /></p>
        </div>
        <MoreHorizontal size={18} className="text-slate-400 dark:text-gray-500" />
      </div>

      {/* caption */}
      {caption ? (
        <p className="whitespace-pre-wrap px-3 py-2 text-[14px] leading-snug text-slate-900 dark:text-gray-100">
          {shown}
          {long && !expanded && (
            <>… <button onClick={() => setExpanded(true)} className="font-semibold text-slate-500 dark:text-gray-400">See more</button></>
          )}
        </p>
      ) : (
        <p className="px-3 py-2 text-[14px] italic text-slate-300 dark:text-gray-600">Your caption appears here…</p>
      )}

      <MediaGrid media={media} />

      {/* link card */}
      {linkUrl && !media.length && (
        <div className="border-y border-slate-200 dark:border-gray-700 bg-slate-100 dark:bg-gray-800 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase text-slate-500 dark:text-gray-400">{domainOf(linkUrl)}</p>
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-gray-200">{linkUrl}</p>
        </div>
      )}

      {/* action bar */}
      <div className="mx-3 mt-1 flex border-t border-slate-200 dark:border-gray-700 py-1 text-slate-500 dark:text-gray-400">
        {[["Like", ThumbsUp], ["Comment", MessageCircle], ["Share", Share2]].map(([label, Icon]) => (
          <span key={label} className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium">
            <Icon size={16} /> {label}
          </span>
        ))}
      </div>

      {/* first comment */}
      {firstComment && (
        <div className="flex items-start gap-2 border-t border-slate-100 dark:border-gray-700 px-3 py-2">
          <Avatar account={account} size={26} />
          <div className="rounded-2xl bg-slate-100 dark:bg-gray-800 px-3 py-1.5">
            <p className="text-xs font-semibold text-slate-900 dark:text-gray-100">{name}</p>
            <p className="whitespace-pre-wrap text-[13px] text-slate-800 dark:text-gray-200">{firstComment}</p>
          </div>
        </div>
      )}
    </div>
  );
}
