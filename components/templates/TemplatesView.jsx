"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, Trash2, Pencil, X, Send } from "lucide-react";
import { apiJson as jsonFetch } from "@/lib/apiClient";

const KINDS = ["caption", "hashtags", "cta", "emoji", "first_comment"];

export default function TemplatesView({ onUse }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => jsonFetch("/api/templates") });
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // template being edited, or null
  const [form, setForm] = useState({ kind: "caption", name: "", content: "" });
  const [busy, setBusy] = useState(false);

  const templates = data?.templates || [];

  function openNew() {
    setForm({ kind: "caption", name: "", content: "" });
    setEditing(null);
    setShowNew(true);
  }

  function openEdit(t) {
    setForm({ kind: t.kind, name: t.name, content: t.content || "" });
    setEditing(t);
    setShowNew(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await jsonFetch(`/api/templates/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name, content: form.content }) });
      } else {
        await jsonFetch("/api/templates", { method: "POST", body: JSON.stringify(form) });
      }
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["templates"] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this template?")) return;
    await jsonFetch(`/api/templates/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["templates"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white"><FileText size={20} /> Templates</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Reusable captions, hashtag sets, CTAs, and first-comment text.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
          <Plus size={15} /> New template
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <FileText size={32} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          <p className="text-sm text-slate-500 dark:text-gray-400">No templates yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-gray-400">{t.kind}</span>
                  <p className="mt-1 truncate font-semibold text-slate-800 dark:text-white">{t.name}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-gray-400">{t.content}</p>
              {onUse && (
                <button onClick={() => onUse(t)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  <Send size={12} /> Use in compose
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <p className="font-semibold text-slate-800 dark:text-white">{editing ? "Edit template" : "New template"}</p>
              <button onClick={() => setShowNew(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              {!editing && (
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              )}
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Template name"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content (caption text, hashtags, CTA, etc.)" rows={5}
                className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-gray-800 px-5 py-3">
              <button onClick={() => setShowNew(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 transition-colors hover:bg-slate-100 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={save} disabled={busy || !form.name.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
