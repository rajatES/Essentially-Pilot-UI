"use client";

import { Bookmark, Heart, MessageCircle, MoreHorizontal, Play, Send } from "lucide-react";
import AccountAvatar from "@/components/common/AccountAvatar";

function Avatar({ account, size = 30 }) {
  return (
    <AccountAvatar
      account={account}
      size={size}
      fallback={
        <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-xs font-bold text-white">
          {account?.display_name?.[0] || "I"}
        </div>
      }
    />
  );
}

// Instagram feed/reel preview. `format`: feed | reel.
export default function InstagramPreview({ account, caption, media, firstComment, format = "feed" }) {
  const name = (account?.display_name || "yourhandle").replace(/\s+/g, "").toLowerCase();
  const video = media.find((m) => m.type === "video");
  const first = media[0];

  if (format === "reel") {
    return (
      <div className="mx-auto w-[240px] overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-800 bg-black shadow-sm">
        <div className="relative aspect-[9/16]">
          {video ? (
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/30"><Play size={26} className="ml-1 text-white" /></span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 text-xs text-white/60">Attach a video</div>
          )}
          <div className="absolute bottom-3 left-2.5 right-10">
            <div className="flex items-center gap-1.5">
              <Avatar account={account} size={24} />
              <span className="text-xs font-semibold text-white drop-shadow">{name}</span>
            </div>
            {caption && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white drop-shadow">{caption}</p>}
          </div>
          <span className="absolute right-2.5 top-2.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Reel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-black shadow-sm">
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar account={account} />
        <span className="flex-1 text-[13px] font-semibold text-slate-900 dark:text-gray-100">{name}</span>
        <MoreHorizontal size={16} className="text-slate-500 dark:text-gray-400" />
      </div>

      {/* square media */}
      <div className="relative aspect-square bg-slate-100 dark:bg-gray-900">
        {first ? (
          first.type === "video" ? (
            <div className="flex h-full items-center justify-center bg-slate-800">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30"><Play size={22} className="ml-0.5 text-white" /></span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={first.url} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400 dark:text-gray-600">Instagram requires media</div>
        )}
        {media.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">1/{media.length}</span>
        )}
      </div>

      {/* carousel dots */}
      {media.length > 1 && (
        <div className="flex justify-center gap-1 py-1.5">
          {media.slice(0, 5).map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-sky-500" : "bg-slate-300 dark:bg-gray-600"}`} />
          ))}
        </div>
      )}

      {/* action row */}
      <div className="flex items-center gap-3.5 px-3 py-2 text-slate-800 dark:text-gray-200">
        <Heart size={20} /> <MessageCircle size={20} /> <Send size={20} />
        <Bookmark size={20} className="ml-auto" />
      </div>

      {/* caption */}
      <div className="space-y-1 px-3 pb-3 text-[13px]">
        {caption ? (
          <p className="line-clamp-3 text-slate-900 dark:text-gray-100">
            <span className="mr-1.5 font-semibold">{name}</span>
            {caption}
          </p>
        ) : (
          <p className="italic text-slate-300 dark:text-gray-600">Your caption appears here…</p>
        )}
        {firstComment && (
          <>
            <p className="text-slate-400 dark:text-gray-500">View all comments</p>
            <p className="line-clamp-1 text-slate-900 dark:text-gray-100">
              <span className="mr-1.5 font-semibold">{name}</span>
              {firstComment}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
