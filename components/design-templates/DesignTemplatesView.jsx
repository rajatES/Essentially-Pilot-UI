"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Palette, Plus, Pencil, Trash2, Copy, Upload, X, Search } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { useDesignTemplates } from "@/lib/queries";
import { useToast } from "@/components/common/ToastProvider";

// Emoji glyph per seeded template key (mirrors the source's TemplateIcon).
const ICONS = {
  version_b: "🏆",
  quote_card: "💬",
  standard_editorial: "📰",
  milestone_montage: "📈",
  career_tribute: "🎖️",
  dramatic_news: "⚡",
  congrats_award: "🎉",
  icon_bullet_explainer: "📋",
  cinematic_teaser: "🎬",
  comparison_card: "⚔️",
  collage_card: "🖼️",
};
const PLACEHOLDER_HINTS = ["{headline}", "{accent}", "{kicker}", "{accent_hex}", "{subject_name}", "{quote_text}", "{scene_description}"];
const EMPTY = { name: "", description: "", prompt: "", tags: "" };

// Downscale an uploaded image to keep the derive payload small and fast.
function downscaleImage(file, maxDim = 1400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DesignTemplatesView() {
  const qc = useQueryClient();
  const showToast = useToast();
  const fileRef = useRef(null);
  const { data, isLoading } = useDesignTemplates();
  const templates = useMemo(() => data?.templates || [], [data]);
  const deriveEnabled = !!data?.deriveEnabled;

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | { id?, name, description, prompt, tags }
  const [busy, setBusy] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, search]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["design-templates"] });
  }

  function openNew() {
    setError("");
    setEditing({ ...EMPTY });
  }
  function openEdit(t) {
    setError("");
    setEditing({ id: t.id, name: t.name || "", description: t.description || "", prompt: t.prompt || "", tags: (t.tags || []).join(", ") });
  }

  async function save() {
    if (!editing?.name.trim()) { setError("A name is required."); return; }
    if (!editing?.prompt.trim()) { setError("A prompt is required."); return; }
    setBusy(true);
    setError("");
    try {
      const payload = JSON.stringify({
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        prompt: editing.prompt.trim(),
        tags: editing.tags.split(",").map((s) => s.trim()).filter(Boolean),
      });
      if (editing.id) await apiJson(`/api/design-templates/${editing.id}`, { method: "PATCH", body: payload });
      else await apiJson("/api/design-templates", { method: "POST", body: payload });
      setEditing(null);
      refresh();
      showToast("Template saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(t) {
    try {
      await apiJson("/api/design-templates", {
        method: "POST",
        body: JSON.stringify({ name: `${t.name} (copy)`, description: t.description, prompt: t.prompt, tags: t.tags, storyTypes: t.story_types }),
      });
      refresh();
      showToast("Template duplicated.");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function remove(t) {
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      await apiJson(`/api/design-templates/${t.id}`, { method: "DELETE" });
      refresh();
      showToast("Template deleted.");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function copyPrompt(t) {
    try {
      await navigator.clipboard.writeText(t.prompt || "");
      showToast("Prompt copied to clipboard.");
    } catch {
      showToast("Couldn't copy — select and copy manually.", "warn");
    }
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDeriving(true);
    setError("");
    try {
      const imageDataUrl = await downscaleImage(file);
      const r = await apiJson("/api/design-templates/derive", { method: "POST", body: JSON.stringify({ imageDataUrl }) });
      setEditing((d) => ({ ...d, prompt: r.prompt || d.prompt }));
      showToast("Draft prompt generated from image.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeriving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white"><Palette size={20} /> Design Templates</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Reusable image-generation prompt templates. Copy one into your image tool, or start from an uploaded reference.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> New template
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 shadow-sm max-w-sm">
        <Search size={14} className="text-slate-400 dark:text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500" />
        {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
          <Palette size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">{search ? "No templates match your search." : "No templates yet"}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">{ICONS[t.template_key] || "🎨"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{t.name}</p>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-gray-400">{t.description}</p>}
                </div>
              </div>
              <p className="mt-2 line-clamp-3 flex-1 rounded-lg bg-slate-50 dark:bg-gray-800/50 p-2 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-gray-400">{t.prompt}</p>
              {(t.tags || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-gray-400">{tag}</span>)}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1 border-t border-slate-100 dark:border-gray-800 pt-2">
                <button onClick={() => copyPrompt(t)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800" title="Copy prompt"><Copy size={13} /> Copy</button>
                <button onClick={() => openEdit(t)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800" title="Edit"><Pencil size={13} /> Edit</button>
                <button onClick={() => duplicate(t)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800" title="Duplicate">Duplicate</button>
                <button onClick={() => remove(t)} className="ml-auto rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300" title="Delete"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <p className="font-semibold text-slate-800 dark:text-white">{editing.id ? "Edit template" : "New template"}</p>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-3 overflow-y-auto p-5">
              <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Template name"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500" />
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Short description (optional)"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500" />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Prompt</label>
                  {deriveEnabled && (
                    <>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                      <button onClick={() => fileRef.current?.click()} disabled={deriving}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50">
                        <Upload size={12} /> {deriving ? "Analyzing…" : "Derive from image"}
                      </button>
                    </>
                  )}
                </div>
                <textarea value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} rows={9} placeholder="Describe the reusable image prompt, using {placeholders} for variable parts…"
                  className="w-full resize-y rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500" />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PLACEHOLDER_HINTS.map((ph) => (
                    <button key={ph} type="button" onClick={() => setEditing((d) => ({ ...d, prompt: `${d.prompt}${ph}` }))}
                      className="rounded bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700">{ph}</button>
                  ))}
                </div>
              </div>
              <input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="Tags, comma-separated (e.g. quote, milestone)"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500" />
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-gray-800 px-5 py-3">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Saving…" : "Save template"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
