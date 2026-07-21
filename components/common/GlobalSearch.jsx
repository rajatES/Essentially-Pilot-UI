"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const VIEW_FOR = { post: "queue", account: "accounts", template: "templates" };

export default function GlobalSearch({ onNavigate }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResults(d.results || []);
        setOpen(true);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex w-52 items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 transition-colors focus-within:border-indigo-500">
        <Search size={14} className="text-slate-400 dark:text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search everything…"
          className="flex-1 bg-transparent text-sm text-slate-800 dark:text-gray-100 outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
        />
        {q && <button onMouseDown={(e) => { e.preventDefault(); setQ(""); setResults([]); }}><X size={13} className="text-slate-400 dark:text-gray-500" /></button>}
      </div>
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-80 w-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
          {results.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400 dark:text-gray-500">No matches</p>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); onNavigate?.(VIEW_FOR[r.type] || "dashboard"); setOpen(false); setQ(""); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-gray-800"
              >
                <span className="rounded bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-gray-400">{r.type}</span>
                <span className="flex-1 truncate text-sm text-slate-700 dark:text-gray-200">{r.title}</span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">{r.sub}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
