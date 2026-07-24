"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layers, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { apiJson as jsonFetch } from "@/lib/apiClient";

const EMPTY = { name: "", groupHead: "", dailyTarget: "" };

export default function DivisionsView({ isAdmin }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["divisions"], queryFn: () => jsonFetch("/api/divisions") });
  const divisions = data?.divisions || [];

  const [editing, setEditing] = useState(null); // null | { id?, name, groupHead, dailyTarget }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Division reads live in two caches: this view's ["divisions"] and the Team
  // roster's ["team"] (which powers the assignment dropdowns).
  function invalidate() {
    qc.invalidateQueries({ queryKey: ["divisions"] });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  function openNew() { setError(""); setEditing({ ...EMPTY }); }
  function openEdit(d) {
    setError("");
    setEditing({ id: d.id, name: d.name || "", groupHead: d.group_head || "", dailyTarget: d.daily_target ?? "" });
  }

  async function save() {
    if (!editing?.name.trim()) { setError("A division name is required."); return; }
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({
        name: editing.name.trim(),
        groupHead: editing.groupHead.trim(),
        dailyTarget: editing.dailyTarget === "" ? null : Number(editing.dailyTarget),
      });
      if (editing.id) await jsonFetch(`/api/divisions/${editing.id}`, { method: "PATCH", body });
      else await jsonFetch("/api/divisions", { method: "POST", body });
      setEditing(null);
      invalidate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    const warn = d.member_count
      ? `Delete "${d.name}"? Its ${d.member_count} member${d.member_count === 1 ? "" : "s"} will be left without a division.`
      : `Delete "${d.name}"?`;
    if (!confirm(warn)) return;
    try {
      await jsonFetch(`/api/divisions/${d.id}`, { method: "DELETE" });
      invalidate();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-gray-400">
          Divisions group your team and drive the per-division targets in Stats.
        </p>
        {isAdmin && (
          <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> New division
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : divisions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
          <Layers size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No divisions yet</p>
          {isAdmin && <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Create one to start assigning teammates and targets.</p>}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-gray-800 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          {divisions.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400">
                  <Layers size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{d.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">
                    {d.group_head ? `Group Head: ${d.group_head}` : "No group head"}
                    {d.daily_target != null && ` · Target ${d.daily_target}/day`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-gray-400">
                  <Users size={11} /> {d.member_count}
                </span>
                {isAdmin && (
                  <>
                    <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-300 transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remove(d)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <p className="font-semibold text-slate-800 dark:text-white">{editing.id ? "Edit division" : "New division"}</p>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-gray-400">Name</label>
                <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. NFL"
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-gray-400">Group Head <span className="text-slate-400 dark:text-gray-500">(optional)</span></label>
                <input value={editing.groupHead} onChange={(e) => setEditing({ ...editing, groupHead: e.target.value })} placeholder="Display name"
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-gray-400">Daily target <span className="text-slate-400 dark:text-gray-500">(optional)</span></label>
                <input type="number" min="0" value={editing.dailyTarget} onChange={(e) => setEditing({ ...editing, dailyTarget: e.target.value })} placeholder="Posts per day"
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-gray-800 px-5 py-3">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {busy ? "Saving…" : editing.id ? "Save changes" : "Create division"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
