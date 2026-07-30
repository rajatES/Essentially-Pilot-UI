"use client";

import { useState } from "react";
import { FolderOpen, ImagePlus, Link as LinkIcon, X } from "lucide-react";
import { apiFetch, apiJson, apiUrl, uploadWithProgress } from "@/lib/apiClient";
import { useToast } from "@/components/common/ToastProvider";
import { pickImageFromGoogleDrive } from "@/lib/googleDrivePicker";
import MediaLibraryView from "@/components/media/MediaLibraryView";

function guessMediaType(nameOrUrl) {
  return /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(nameOrUrl || "") ? "video" : "image";
}

function formatBytes(n) {
  if (!n && n !== 0) return "";
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

// Media space of the composer: Upload / Library / URL / Google Drive / Canva
// sources plus drag-and-drop. All files upload to S3 immediately and land in
// the shared `media` array ([{url, type, name?}], first item = thumbnail).
export default function MediaPanel({ media, onChange, meId }) {
  const showToast = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // { name, pct } while a file uploads
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCanva, setShowCanva] = useState(false);
  const [canvaDesigns, setCanvaDesigns] = useState([]);
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        setProgress({ name: f.name, pct: 0 });
        const fd = new FormData();
        fd.append("file", f);
        const up = await uploadWithProgress("/api/upload", fd, (pct) => setProgress({ name: f.name, pct }));
        onChange((prev) => [...prev, { url: up.url, type: f.type?.startsWith("video") ? "video" : "image", name: f.name }]);
        // Server auto-downscales oversized images so platforms (esp. Facebook)
        // don't reject them — tell the user it happened.
        if (up.optimized) {
          showToast(
            `“${f.name}” was large (${formatBytes(up.originalSizeBytes)}) and was optimized to ${formatBytes(up.sizeBytes)} to fit the social platforms' limits.`,
            "warn",
          );
        }
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  function applyUrl() {
    const u = urlDraft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { showToast("Enter a valid media URL starting with https://", "error"); return; }
    onChange((prev) => [...prev, { url: u, type: guessMediaType(u) }]);
    setUrlDraft("");
    setShowUrlInput(false);
  }

  async function connectGoogleDrive() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!clientId || !apiKey) {
      showToast("Google Drive isn't configured yet — add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY (see README-integrations.md).", "warn");
      return;
    }
    try {
      // Each user signs into their OWN Google account; nothing stored server-side.
      const file = await pickImageFromGoogleDrive({ clientId, apiKey });
      if (!file) return; // user cancelled the picker
      await uploadFiles([file]);
      showToast(`Added “${file.name}” from Google Drive.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function connectCanva() {
    try {
      const r = await apiFetch("/api/canva/designs");
      if (r.status === 501) {
        showToast("Canva isn't configured yet — set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET (see README-integrations.md).", "warn");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Canva check failed.");
      if (!d.connected) {
        // First time: send this user to Canva to authorize their own account.
        window.location.href = apiUrl(`/api/auth/canva/start?uid=${encodeURIComponent(meId || "")}`);
        return;
      }
      setCanvaDesigns(d.designs);
      setShowCanva(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function pickCanvaDesign(designId) {
    setCanvaBusy(true);
    try {
      const r = await apiFetch("/api/canva/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Canva export failed.");
      onChange((prev) => [...prev, { url: d.url, type: "image" }]);
      setShowCanva(false);
      showToast("Canva design added to your post.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCanvaBusy(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${dragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-gray-800"}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Media</p>

      {progress && (
        <div className="mb-2 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-2">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-indigo-700 dark:text-indigo-300">
            <span className="truncate pr-2">Uploading {progress.name}</span>
            <span className="shrink-0">{progress.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/20">
            <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-200 ease-out" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative">
              {m.type === "video" ? (
                <div className="flex h-16 w-16 items-center justify-center rounded border border-slate-200 dark:border-gray-800 bg-slate-900 text-[9px] font-bold text-white">VIDEO</div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.url} alt="" className="h-16 w-16 rounded border border-slate-200 dark:border-gray-800 object-cover" />
              )}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 text-[8px] font-semibold text-white">1st</span>
              )}
              <button type="button" onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white hover:bg-red-500">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <ImagePlus size={18} className="text-slate-500 dark:text-gray-400" />
          Upload
          <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading}
            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={() => setShowLibrary(true)}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <FolderOpen size={18} className="text-slate-500 dark:text-gray-400" /> Library
        </button>
        <button type="button" onClick={() => setShowUrlInput((v) => !v)}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <LinkIcon size={18} className="text-slate-500 dark:text-gray-400" /> Media URL
        </button>
        <button type="button" onClick={connectGoogleDrive}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#0066da" d="M6 22l4-7H24l-4 7z"/><path fill="#00ac47" d="M2 15l4-7 7 12H6z" transform="translate(-1 0)"/><path fill="#ea4335" d="M8 2h8l7 12h-8z" transform="translate(-1 0)"/><path fill="#ffba00" d="M8 2 1 14l4 7 7-12z"/><path fill="#00832d" d="M6 22l4-7h8l-4 7z"/><path fill="#2684fc" d="M18 15h6l-4 7-2-3z"/></svg>
          Google Drive
        </button>
        <button type="button" onClick={connectCanva}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-purple-500 text-[9px] font-bold text-white">C</span>
          Canva
        </button>
      </div>

      {showUrlInput && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyUrl(); } }}
            placeholder="Paste image/video URL (Canva export, Drive public link, etc.)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={applyUrl}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Add
          </button>
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400 dark:text-gray-500">Drag &amp; drop files anywhere in this box. First item becomes the thumbnail.</p>

      {/* ── Media library picker modal ── */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowLibrary(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800 dark:text-white">Choose from Media Library</p>
              <button onClick={() => setShowLibrary(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <MediaLibraryView
              onPick={(asset) => {
                onChange((prev) => [...prev, { url: asset.url, type: guessMediaType(asset.url) }]);
                setShowLibrary(false);
                apiJson(`/api/media/${asset.id}`, { method: "PATCH", body: JSON.stringify({ markUsed: true }) }).catch(() => {});
              }}
            />
          </div>
        </div>
      )}

      {/* ── Canva design picker ── */}
      {showCanva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !canvaBusy && setShowCanva(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800 dark:text-white">Choose a Canva design</p>
              <button onClick={() => setShowCanva(false)} disabled={canvaBusy} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            {canvaBusy && <p className="mb-3 text-sm text-indigo-600 dark:text-indigo-400">Exporting design from Canva…</p>}
            {canvaDesigns.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400 dark:text-gray-500">No designs found in your Canva account yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {canvaDesigns.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={canvaBusy}
                    onClick={() => pickCanvaDesign(d.id)}
                    className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 text-left hover:border-indigo-400 hover:shadow disabled:opacity-50"
                  >
                    {d.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.thumbnail} alt={d.title} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600"><ImagePlus size={22} /></div>
                    )}
                    <p className="truncate px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-gray-200">{d.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
