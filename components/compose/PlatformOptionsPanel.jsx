"use client";

import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

// Platform-specific options, shown only for the selected platforms:
//   Facebook  → format: Post | Reel | Story
//   Instagram → format: Feed | Reel
//   YouTube   → video title + privacy
// (Threads/X have no extra options yet.)
export default function PlatformOptionsPanel({ selectedPlatforms, options, onChange, captionFirstLine }) {
  const relevant = selectedPlatforms.filter((p) => ["facebook", "instagram", "youtube"].includes(p));
  if (!relevant.length) return null;

  const set = (platform, patch) =>
    onChange({ ...options, [platform]: { ...(options?.[platform] || {}), ...patch } });

  const Radio = ({ platform, field, value, current, label }) => (
    <button
      type="button"
      onClick={() => set(platform, { [field]: value })}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        (current || "") === value || (!current && value === (field === "format" ? (platform === "instagram" ? "feed" : "post") : ""))
          ? "bg-indigo-600 text-white"
          : "border border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-gray-800 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Platform options</p>

      {relevant.includes("facebook") && (
        <div className="flex items-center gap-3">
          <span className="flex w-24 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
            <PlatformIcon platform="facebook" size={13} /> {PLATFORM_META.facebook.label}
          </span>
          <div className="flex gap-1.5">
            <Radio platform="facebook" field="format" value="post" current={options?.facebook?.format} label="Post" />
            <Radio platform="facebook" field="format" value="reel" current={options?.facebook?.format} label="Reel" />
            <Radio platform="facebook" field="format" value="story" current={options?.facebook?.format} label="Story" />
          </div>
        </div>
      )}

      {relevant.includes("instagram") && (
        <div className="flex items-center gap-3">
          <span className="flex w-24 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
            <PlatformIcon platform="instagram" size={13} /> {PLATFORM_META.instagram.label}
          </span>
          <div className="flex gap-1.5">
            <Radio platform="instagram" field="format" value="feed" current={options?.instagram?.format} label="Feed" />
            <Radio platform="instagram" field="format" value="reel" current={options?.instagram?.format} label="Reel" />
          </div>
        </div>
      )}

      {relevant.includes("youtube") && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300">
              <PlatformIcon platform="youtube" size={13} /> {PLATFORM_META.youtube.label}
            </span>
            <input
              value={options?.youtube?.title || ""}
              onChange={(e) => set("youtube", { title: e.target.value })}
              maxLength={100}
              placeholder={captionFirstLine ? `Title: “${captionFirstLine.slice(0, 60)}${captionFirstLine.length > 60 ? "…" : ""}”` : "Video title (defaults to the first caption line)"}
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
            />
            <select
              value={options?.youtube?.privacy || "public"}
              onChange={(e) => set("youtube", { privacy: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs outline-none"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
