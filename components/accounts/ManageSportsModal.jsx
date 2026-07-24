"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash2, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { useSports } from "@/lib/queries";
import { useToast } from "@/components/common/ToastProvider";

// Admin-only editor for the sports/vertical taxonomy. "Other" is a reserved
// fallback and never appears here. Removing a sport moves any pages set to it
// back to "Other" (handled server-side).
export default function ManageSportsModal({ onClose }) {
  const qc = useQueryClient();
  const showToast = useToast();
  const { data, isLoading } = useSports();
  const sports = data?.sports || [];

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sports"] });
    qc.invalidateQueries({ queryKey: ["posts"] }); // account categories may have changed
  }

  async function add() {
    const n = name.trim();
    if (!n) return;
    setError("");
    setBusy(true);
    try {
      await apiJson("/api/sports", { method: "POST", body: JSON.stringify({ name: n }) });
      setName("");
      refresh();
      showToast("Sport added.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(sport) {
    if (!confirm(`Remove "${sport.name}"? Any pages set to it will move to "Other".`)) return;
    try {
      const r = await apiJson(`/api/sports/${sport.id}`, { method: "DELETE" });
      refresh();
      showToast(
        r.reassigned ? `Removed "${sport.name}". ${r.reassigned} page(s) moved to Other.` : `Removed "${sport.name}".`,
      );
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
          <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
            <Tag size={16} /> Manage sports
          </p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="Add a sport (e.g. Rugby)"
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={add}
              disabled={busy || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={15} /> Add
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

          <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-gray-800" />)
            ) : sports.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">No sports yet — add your first above.</p>
            ) : (
              sports.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-gray-200">{s.name}</span>
                  <button
                    onClick={() => remove(s)}
                    className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    title={`Remove ${s.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400 dark:text-gray-500">
            &quot;Other&quot; is always available as a fallback and can&apos;t be removed.
          </p>
        </div>
      </div>
    </div>
  );
}
