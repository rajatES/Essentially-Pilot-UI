"use client";

import { Heart, MessageCircle, Play, Repeat2, Send } from "lucide-react";
import AccountAvatar from "@/components/common/AccountAvatar";

function Avatar({ account, size = 34 }) {
  return (
    <AccountAvatar
      account={account}
      size={size}
      fallback={
        <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-slate-800 dark:bg-gray-200 text-xs font-bold text-white dark:text-gray-900">
          {account?.display_name?.[0] || "T"}
        </div>
      }
    />
  );
}

// Threads post preview (with the first reply threaded underneath).
export default function ThreadsPreview({ account, caption, media, firstComment }) {
  const name = (account?.display_name || "yourhandle").replace(/\s+/g, "").toLowerCase();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-black p-3 shadow-sm">
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center">
          <Avatar account={account} />
          {firstComment && <span className="mt-1 w-0.5 flex-1 rounded bg-slate-200 dark:bg-gray-700" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-900 dark:text-gray-100">{name}</span>
            <span className="text-xs text-slate-400 dark:text-gray-500">now</span>
          </div>
          {caption ? (
            <p className="whitespace-pre-wrap text-[13px] leading-snug text-slate-900 dark:text-gray-100">{caption}</p>
          ) : (
            <p className="text-[13px] italic text-slate-300 dark:text-gray-600">Your caption appears here…</p>
          )}
          {media.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto">
              {media.slice(0, 4).map((m, i) => (
                m.type === "video" ? (
                  <div key={i} className="flex h-32 w-40 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/30"><Play size={17} className="ml-0.5 text-white" /></span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={m.url} alt="" className="h-32 w-auto shrink-0 rounded-lg border border-slate-100 dark:border-gray-800 object-cover" />
                )
              ))}
            </div>
          )}
          <div className="mt-2.5 flex items-center gap-4 text-slate-700 dark:text-gray-300">
            <Heart size={18} /> <MessageCircle size={18} /> <Repeat2 size={18} /> <Send size={18} />
          </div>
        </div>
      </div>

      {/* threaded first reply */}
      {firstComment && (
        <div className="mt-2 flex gap-2.5">
          <Avatar account={account} size={24} />
          <div className="min-w-0 flex-1">
            <span className="text-[12px] font-semibold text-slate-900 dark:text-gray-100">{name}</span>
            <p className="whitespace-pre-wrap text-[12px] leading-snug text-slate-800 dark:text-gray-200">{firstComment}</p>
          </div>
        </div>
      )}
    </div>
  );
}
