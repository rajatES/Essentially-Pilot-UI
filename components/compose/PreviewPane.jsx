"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";
import FacebookPreview from "./previews/FacebookPreview";
import InstagramPreview from "./previews/InstagramPreview";
import ThreadsPreview from "./previews/ThreadsPreview";
import YouTubePreview from "./previews/YouTubePreview";
import XPreview from "./previews/XPreview";

// RIGHT panel: live post preview, one tab per selected platform, rendered
// with the identity of the first selected account of that platform.
export default function PreviewPane({ selectedPlatforms, effectiveCaption, accountFor, state }) {
  const [tab, setTab] = useState(selectedPlatforms[0] || null);

  // Keep the active tab valid as the selection changes.
  useEffect(() => {
    if (!selectedPlatforms.includes(tab)) setTab(selectedPlatforms[0] || null);
  }, [selectedPlatforms, tab]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 rounded-t-xl">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white"><Eye size={14} /> Preview</p>
        {selectedPlatforms.length > 0 && (
          <div className="flex gap-1">
            {selectedPlatforms.map((p) => (
              <button
                key={p}
                onClick={() => setTab(p)}
                title={PLATFORM_META[p]?.label}
                className={`rounded-lg p-1.5 transition-colors ${tab === p ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-300 dark:ring-indigo-500/40" : "hover:bg-slate-100 dark:hover:bg-gray-800"}`}
              >
                <PlatformIcon platform={p} size={15} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-3">
        {!tab ? (
          <p className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">Select an account to see the preview.</p>
        ) : tab === "facebook" ? (
          <FacebookPreview
            account={accountFor("facebook")}
            caption={effectiveCaption("facebook")}
            media={state.media}
            linkUrl={state.linkUrl}
            firstComment={state.firstComment}
            format={state.platformOptions?.facebook?.format || "post"}
          />
        ) : tab === "instagram" ? (
          <InstagramPreview
            account={accountFor("instagram")}
            caption={effectiveCaption("instagram")}
            media={state.media}
            firstComment={state.firstComment}
            format={state.platformOptions?.instagram?.format || "feed"}
          />
        ) : tab === "threads" ? (
          <ThreadsPreview
            account={accountFor("threads")}
            caption={effectiveCaption("threads")}
            media={state.media}
            firstComment={state.firstComment}
          />
        ) : tab === "youtube" ? (
          <YouTubePreview
            account={accountFor("youtube")}
            caption={effectiveCaption("youtube")}
            media={state.media}
            options={state.platformOptions?.youtube}
          />
        ) : (
          <XPreview
            account={accountFor("twitter")}
            caption={effectiveCaption("twitter")}
            media={state.media}
          />
        )}
      </div>
    </div>
  );
}
