"use client";

import { useRef, useState } from "react";
import { Hash, Smile } from "lucide-react";
import { PLATFORM_LIMITS } from "@/lib/platformRules";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

const EMOJIS = ["🔥","💪","🏆","⚡","🎯","👀","😤","🤯","😱","🙌","👏","💯","🚀","⭐","❤️","😂","🤔","😮","🏈","🏀","⚾","🏒","⚽","🎾","🥊","🏁","🎙️","📸","📊","⏰","✅","❗"];

// Caption editor: master textarea with per-platform character counters,
// emoji + hashtag inserts, and the "Customize for Each Platform" toggle
// (per-platform caption tabs override the master; empty tab falls back).
export default function CaptionEditor({ state, update, selectedPlatforms, defaultHashtags }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // platform when customizing
  const textareaRef = useRef(null);

  const editingPlatform = state.customize && activeTab ? activeTab : null;
  const editingValue = editingPlatform
    ? state.platformCaptions?.[editingPlatform] ?? ""
    : state.body;

  function setEditingValue(value) {
    if (editingPlatform) {
      update({ platformCaptions: { ...state.platformCaptions, [editingPlatform]: value } });
    } else {
      update({ body: value });
    }
  }

  function insertAtCursor(text) {
    const el = textareaRef.current;
    if (!el) { setEditingValue(editingValue + text); return; }
    const start = el.selectionStart ?? editingValue.length;
    const end = el.selectionEnd ?? editingValue.length;
    const next = editingValue.slice(0, start) + text + editingValue.slice(end);
    setEditingValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  function toggleCustomize() {
    if (state.customize) {
      // Turning OFF discards per-platform edits after confirmation.
      const hasEdits = Object.values(state.platformCaptions || {}).some((v) => v?.trim());
      if (hasEdits && !confirm("Turn off per-platform customization? Platform-specific captions will be discarded and every platform will use the main caption.")) {
        return;
      }
      update({ customize: false, platformCaptions: {} });
      setActiveTab(null);
    } else {
      update({ customize: true });
      setActiveTab(null); // start on the master tab
    }
  }

  const effectiveFor = (p) => (state.customize && state.platformCaptions?.[p]?.trim()) || state.body;

  return (
    <div>
      {/* customize tabs */}
      {state.customize && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab(null)}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold ${activeTab === null ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"}`}
          >
            Main caption
          </button>
          {selectedPlatforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActiveTab(p)}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-xs font-semibold ${activeTab === p ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"}`}
            >
              <PlatformIcon platform={p} size={12} /> {PLATFORM_META[p]?.label}
              {state.platformCaptions?.[p]?.trim() && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={editingValue}
        onChange={(e) => setEditingValue(e.target.value)}
        rows={7}
        placeholder={
          editingPlatform
            ? `Custom ${PLATFORM_META[editingPlatform]?.label} caption — leave empty to use the main caption`
            : "Write your post here…"
        }
        className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
      />

      {/* toolbar: emoji, hashtags, customize toggle, char counters */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button type="button" onClick={() => setShowEmoji((v) => !v)}
            title="Insert emoji"
            className="rounded-lg border border-slate-200 dark:border-gray-800 p-1.5 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/50">
            <Smile size={15} />
          </button>
          {showEmoji && (
            <div className="absolute left-0 top-9 z-20 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button key={e} type="button" className="rounded p-1 text-base hover:bg-slate-100 dark:hover:bg-gray-800"
                  onClick={() => { insertAtCursor(e); setShowEmoji(false); }}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => insertAtCursor(" #")}
          title="Insert hashtag"
          className="rounded-lg border border-slate-200 dark:border-gray-800 p-1.5 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <Hash size={15} />
        </button>
        {defaultHashtags && (
          <button type="button"
            onClick={() => setEditingValue(editingValue ? `${editingValue}\n\n${defaultHashtags}` : defaultHashtags)}
            className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
            + Default hashtags
          </button>
        )}
        {selectedPlatforms.length > 0 && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-gray-300">
            <input type="checkbox" checked={state.customize} onChange={toggleCustomize}
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
            Customize for each platform
          </label>
        )}
      </div>

      {/* per-platform character counters */}
      {selectedPlatforms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedPlatforms.map((p) => {
            const len = effectiveFor(p).length;
            const limit = PLATFORM_LIMITS[p]?.caption;
            const over = limit && len > limit;
            return (
              <span key={p} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                over ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400"
              }`}>
                <PlatformIcon platform={p} size={11} />
                {len.toLocaleString()}{limit ? ` / ${limit.toLocaleString()}` : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
