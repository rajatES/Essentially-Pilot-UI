"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsInvalidate } from "@/lib/queries";

// Minimal CSV parser — handles quoted fields, escaped quotes, and CRLF.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const CSV_TEMPLATE = `text,scheduled_for,pages,image_url,link_url,first_comment,content_type
"Big fight tonight — who are you backing?",2026-07-10 19:00,Boxing News and Memes,https://example.com/img.jpg,,,meme_image
"Race day! 🏁",2026-07-11 13:00,"Forever the Intimidator Fan Club",,,"Full story in the comments",lic
"Posts to every connected page",2026-07-12 09:00,all,,,,`;
// content_type is optional for bulk import (infographic / meme_image / lic, or leave blank) —
// unlike single-post scheduling, bulk rows aren't required to have one.

// Bulk CSV import modal, extracted from app/app/page.js.
export default function CsvImportModal({ onClose }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bulk-posts-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsvFile(file) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) throw new Error("CSV needs a header row plus at least one post row.");
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const col = (name) => header.indexOf(name);
      if (col("text") === -1 || col("scheduled_for") === -1) {
        throw new Error('CSV must include "text" and "scheduled_for" columns — download the template below.');
      }
      const rows = grid.slice(1).map((r) => ({
        text: r[col("text")] || "",
        scheduledFor: r[col("scheduled_for")] || "",
        pages: col("pages") !== -1 ? r[col("pages")] || "" : "all",
        imageUrl: col("image_url") !== -1 ? r[col("image_url")] || "" : "",
        linkUrl: col("link_url") !== -1 ? r[col("link_url")] || "" : "",
        firstComment: col("first_comment") !== -1 ? r[col("first_comment")] || "" : "",
        contentType: col("content_type") !== -1 ? r[col("content_type")] || "" : ""
      }));
      const res = await apiJson("/api/posts/import", { method: "POST", body: JSON.stringify({ rows }) });
      setResult(res);
      if (res.created > 0) {
        showToast(`Imported ${res.created} post(s)${res.errors.length ? ` — ${res.errors.length} row(s) skipped` : ""}.`, res.errors.length ? "warn" : "ok");
        invalidatePosts();
      } else {
        showToast("Nothing imported — check the row errors.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-slate-800 dark:text-white">Bulk import posts from CSV</p>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm text-slate-500 dark:text-gray-400">
          Columns: <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">text</code> and <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">scheduled_for</code> are
          required; <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">pages</code> (names or “all”), <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">image_url</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">link_url</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">first_comment</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">content_type</code> (infographic/meme_image/lic) are optional — unlike single-post scheduling, bulk rows don't require a content type.
          Imported posts are queued and publish automatically at their scheduled time. Up to 200 rows.
        </p>
        <div className="flex items-center gap-2">
          <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <ImagePlus size={15} /> {busy ? "Importing…" : "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importCsvFile(f); }} />
          </label>
          <button onClick={downloadCsvTemplate}
            className="rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
            Download template
          </button>
        </div>
        {result && (
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3 text-sm">
            <p className="font-medium text-slate-700 dark:text-gray-200">
              ✓ {result.created} post(s) imported{result.errors.length ? ` · ${result.errors.length} row(s) skipped:` : "."}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
