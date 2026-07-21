"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, Star, Trash2, FolderPlus, Folder, X } from "lucide-react";
import { apiFetch, apiJson as jsonFetch } from "@/lib/apiClient";

// Registers an already-uploaded file (via /api/upload) into the media_assets library.
async function registerAsset(uploaded, folderId) {
  return jsonFetch("/api/media", {
    method: "POST",
    body: JSON.stringify({
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      hash: uploaded.hash,
      source: "upload",
      folderId: folderId || null
    })
  });
}

export default function MediaLibraryView({ onPick }) {
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const fileInput = useRef(null);

  const assetsKey = ["media-assets", folderId, favoritesOnly];
  const { data, isLoading } = useQuery({
    queryKey: assetsKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      if (favoritesOnly) params.set("favorite", "1");
      return jsonFetch(`/api/media?${params.toString()}`);
    }
  });
  const { data: foldersData } = useQuery({ queryKey: ["media-folders"], queryFn: () => jsonFetch("/api/media/folders") });

  const assets = data?.assets || [];
  const folders = foldersData?.folders || [];

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await apiFetch("/api/upload", { method: "POST", body: fd });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploaded.error || "Upload failed.");
      await registerAsset(uploaded, folderId);
      qc.invalidateQueries({ queryKey: ["media-assets"] });
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function toggleFavorite(asset) {
    await jsonFetch(`/api/media/${asset.id}`, { method: "PATCH", body: JSON.stringify({ isFavorite: !asset.is_favorite }) });
    qc.invalidateQueries({ queryKey: ["media-assets"] });
  }

  async function remove(asset) {
    if (!confirm("Delete this media asset? This only removes it from the library, not from posts already using it.")) return;
    await jsonFetch(`/api/media/${asset.id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["media-assets"] });
  }

  async function createFolder() {
    if (!newFolder.trim()) return;
    await jsonFetch("/api/media/folders", { method: "POST", body: JSON.stringify({ name: newFolder.trim() }) });
    setNewFolder("");
    setShowNewFolder(false);
    qc.invalidateQueries({ queryKey: ["media-folders"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white"><ImageIcon size={20} /> Media Library</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Reusable images — upload once, use across posts.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
            <Upload size={15} /> {uploading ? "Uploading…" : "Upload"}
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
          <option value="">All folders</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => setFavoritesOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${favoritesOnly ? "border-amber-400 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300"}`}>
          <Star size={14} className={favoritesOnly ? "fill-amber-400 text-amber-400" : ""} /> Favorites
        </button>
        <button onClick={() => setShowNewFolder((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 transition-colors hover:bg-slate-50 dark:hover:bg-gray-800">
          <FolderPlus size={14} /> New folder
        </button>
        {showNewFolder && (
          <div className="flex items-center gap-1.5">
            <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
              placeholder="Folder name" className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            <button onClick={createFolder} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700">Add</button>
            <button onClick={() => setShowNewFolder(false)} className="text-slate-400 dark:text-gray-500 transition-colors hover:text-slate-600 dark:hover:text-gray-300"><X size={14} /></button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <ImageIcon size={32} className="mx-auto mb-3 text-slate-300 dark:text-gray-600" />
          <p className="text-sm text-slate-500 dark:text-gray-400">No media yet — upload an image to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 shadow-sm transition-shadow hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={asset.filename || ""} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-start justify-between bg-black/0 p-1.5 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
                <button onClick={() => toggleFavorite(asset)} className="rounded-full bg-white/90 p-1.5 transition-colors hover:bg-white">
                  <Star size={13} className={asset.is_favorite ? "fill-amber-400 text-amber-400" : "text-slate-500"} />
                </button>
                <button onClick={() => remove(asset)} className="rounded-full bg-white/90 p-1.5 transition-colors hover:bg-white">
                  <Trash2 size={13} className="text-red-500" />
                </button>
              </div>
              {onPick && (
                <button onClick={() => onPick(asset)}
                  className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-indigo-600 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Use in post
                </button>
              )}
              {asset.folder_id && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  <Folder size={9} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
