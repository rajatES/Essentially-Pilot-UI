"use client";

import { useEffect, useRef, useState } from "react";
import { X, GripVertical, Search, RotateCcw } from "lucide-react";
import { COLUMN_GROUPS, COLUMN_BY_KEY, DEFAULT_VISIBLE } from "@/lib/postAnalyticsColumns";

// Show/hide + drag-reorder columns for the Post Analytics table, modeled on
// Meta's "Customise columns" dialog. Returns the ordered list of visible keys
// on Apply; discards on Cancel.
export default function CustomiseColumnsModal({ visible, onApply, onClose }) {
  const [draft, setDraft] = useState(visible);
  const [search, setSearch] = useState("");
  const dragKey = useRef(null);

  // Re-seed if the caller's visible set changes while mounted.
  useEffect(() => { setDraft(visible); }, [visible]);

  const draftSet = new Set(draft);

  function toggle(key) {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function toggleGroup(cols, allOn) {
    const keys = cols.map((c) => c.key);
    setDraft((prev) =>
      allOn ? prev.filter((k) => !keys.includes(k)) : [...prev, ...keys.filter((k) => !prev.includes(k))],
    );
  }
  function remove(key) {
    setDraft((prev) => prev.filter((k) => k !== key));
  }

  // Native drag-reorder of the visible list.
  function onDrop(targetKey) {
    const from = dragKey.current;
    dragKey.current = null;
    if (!from || from === targetKey) return;
    setDraft((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
      return next;
    });
  }

  const q = search.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
          <p className="text-lg font-bold text-slate-800 dark:text-white">Customise columns</p>
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-gray-800 p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          {/* Show / hide */}
          <div className="flex flex-col overflow-hidden border-b border-slate-100 dark:border-gray-800 md:border-b-0 md:border-r">
            <div className="px-5 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">Show or hide columns</p>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
                <Search size={14} className="text-slate-400 dark:text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-200"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {COLUMN_GROUPS.map((group) => {
                const cols = group.columns.filter((c) => !q || c.label.toLowerCase().includes(q));
                if (!cols.length) return null;
                const onCount = group.columns.filter((c) => draftSet.has(c.key)).length;
                const allOn = onCount === group.columns.length;
                const someOn = onCount > 0 && !allOn;
                return (
                  <div key={group.label} className="border-b border-slate-100 py-2 last:border-b-0 dark:border-gray-800">
                    <label className="flex items-center gap-2 py-1.5 text-sm font-semibold text-slate-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => el && (el.indeterminate = someOn)}
                        onChange={() => toggleGroup(group.columns, allOn)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                      />
                      {group.label}
                    </label>
                    {cols.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 py-1.5 pl-6 text-sm text-slate-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={draftSet.has(c.key)}
                          onChange={() => toggle(c.key)}
                          className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reorder */}
          <div className="flex flex-col overflow-hidden bg-slate-50/60 dark:bg-gray-800/30">
            <p className="px-5 pt-4 text-sm font-semibold text-slate-800 dark:text-white">Reorder columns</p>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {draft.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">No columns selected.</p>
              ) : (
                <div className="space-y-1">
                  {draft.map((key) => {
                    const c = COLUMN_BY_KEY[key];
                    if (!c) return null;
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={() => (dragKey.current = key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(key)}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <GripVertical size={15} className="shrink-0 cursor-grab text-slate-300 dark:text-gray-600" />
                        <span className="flex-1">{c.label}</span>
                        <button onClick={() => remove(key)} className="shrink-0 text-slate-400 hover:text-red-500 dark:text-gray-500">
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-gray-800 px-5 py-4">
          <button
            onClick={() => setDraft(DEFAULT_VISIBLE)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/50"
          >
            <RotateCcw size={14} /> Restore defaults
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/50">
              Cancel
            </button>
            <button
              onClick={() => { onApply(draft); onClose(); }}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
