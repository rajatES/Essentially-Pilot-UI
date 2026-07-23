"use client";

import { BarChart2, Heart, MessageCircle, Play, Repeat2, Share } from "lucide-react";

// Basic X (Twitter) post preview.
export default function XPreview({ account, caption, media }) {
  const name = account?.display_name || "Your Account";
  const handle = "@" + name.replace(/\s+/g, "").toLowerCase();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-black p-3 shadow-sm">
      <div className="flex gap-2.5">
        {account?.avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={account.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-gray-100 text-sm font-bold text-white dark:text-gray-900">{name[0]}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px]">
            <span className="font-bold text-slate-900 dark:text-gray-100">{name}</span>
            <span className="ml-1.5 text-slate-500 dark:text-gray-500">{handle} · now</span>
          </p>
          {caption ? (
            <p className="whitespace-pre-wrap text-[14px] leading-snug text-slate-900 dark:text-gray-100">{caption}</p>
          ) : (
            <p className="text-[14px] italic text-slate-300 dark:text-gray-600">Your post appears here…</p>
          )}
          {media.length > 0 && (
            <div className={`mt-2 grid gap-0.5 overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-700 ${media.length > 1 ? "grid-cols-2" : ""}`}>
              {media.slice(0, 4).map((m, i) => (
                m.type === "video" ? (
                  <div key={i} className="flex h-32 items-center justify-center bg-slate-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30"><Play size={18} className="ml-0.5 text-white" /></span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={m.url} alt="" className={`w-full object-cover ${media.length === 1 ? "max-h-64" : "h-32"}`} />
                )
              ))}
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between pr-6 text-slate-500 dark:text-gray-500">
            <MessageCircle size={16} /> <Repeat2 size={16} /> <Heart size={16} /> <BarChart2 size={16} /> <Share size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}
