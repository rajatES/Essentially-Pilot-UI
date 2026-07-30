"use client";

import { Play } from "lucide-react";
import AccountAvatar from "@/components/common/AccountAvatar";

// YouTube video-card preview: 16:9 thumbnail, title (custom or first caption
// line), channel identity, and the chosen privacy badge.
export default function YouTubePreview({ account, caption, media, options }) {
  const channel = account?.display_name || "Your Channel";
  const video = media.find((m) => m.type === "video");
  const thumb = media.find((m) => m.type === "image");
  const title = (options?.title || caption?.split("\n")[0] || "").slice(0, 100);
  const privacy = options?.privacy || "public";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm">
      <div className="relative aspect-video bg-slate-900">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb.url} alt="" className="h-full w-full object-cover" />
        ) : video ? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">Attach a video</div>
        )}
        {(video || thumb) && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-red-600"><Play size={22} className="ml-0.5 text-white" fill="white" /></span>
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">0:00</span>
      </div>
      <div className="flex gap-2.5 p-3">
        <AccountAvatar
          account={account}
          size={36}
          className="shrink-0"
          fallback={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">{channel[0]}</div>
          }
        />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-gray-100">
            {title || <span className="italic text-slate-300 dark:text-gray-600">Video title from the first caption line…</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{channel}</p>
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            privacy === "public" ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300"
          }`}>{privacy}</span>
        </div>
      </div>
    </div>
  );
}
