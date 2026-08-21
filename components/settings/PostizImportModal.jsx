"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { PlatformIcon } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsInvalidate } from "@/lib/queries";

// Import Threads / personal-Instagram channels from the Postiz workspace.
//
// There is no OAuth to run here: Postiz owns the platform tokens, so the user
// authorizes the channel inside Postiz and this modal copies the result into a
// social_accounts row. Once imported, the channel is an ordinary account —
// same composer, same queue, same approvals — and publishes via the backend's
// Postiz bridge (backend/src/lib/postiz.js).
//
// Provider labels: Postiz distinguishes Instagram linked to a Facebook page
// from a standalone (personal/creator) login. Both land as platform
// "instagram" here, so the badge is the only place the difference is visible.
const PROVIDER_LABEL = {
  threads: "Threads",
  instagram: "Instagram (via Facebook)",
  "instagram-standalone": "Instagram (personal)",
};

export default function PostizImportModal({ onClose }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // { configured, connected, error }
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState(null);
  const [picks, setPicks] = useState([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Status first: it distinguishes "no key configured" and "key rejected"
      // from "nothing connected in Postiz yet", which need different fixes.
      const s = await apiJson("/api/postiz/status");
      setStatus(s);
      if (!s.configured || !s.connected) {
        setChannels([]);
        return;
      }
      const { integrations } = await apiJson("/api/postiz/integrations");
      setChannels(integrations || []);
      setPicks([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const importable = channels.filter((c) => !c.imported);

  function toggle(id) {
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function runImport() {
    if (!picks.length) return;
    setImporting(true);
    try {
      const res = await apiJson("/api/postiz/import", {
        method: "POST",
        body: JSON.stringify({ channels: picks.map((id) => ({ id })) }),
      });
      showToast(`Imported ${res.imported} channel${res.imported === 1 ? "" : "s"}.`);
      invalidatePosts();
      onClose?.();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white">Import Postiz channels</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
              Threads and personal Instagram profiles publish through your Postiz workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Reading your Postiz workspace…
            </div>
          )}

          {!loading && error && <Notice tone="error">{error}</Notice>}

          {!loading && !error && status && !status.configured && (
            <Notice tone="warn">
              Postiz isn’t configured on the server yet. Add <Code>POSTIZ_API_KEY</Code> to the backend
              environment (Postiz → Settings → Developers → your API key) and restart the backend.
            </Notice>
          )}

          {!loading && !error && status?.configured && !status.connected && (
            <Notice tone="error">
              Postiz rejected the configured API key{status.error ? `: ${status.error}` : "."} Check that the key is
              current and that the workspace is on a plan with API access (Cloud Standard or above).
            </Notice>
          )}

          {!loading && !error && status?.connected && !channels.length && (
            <Notice tone="warn">
              No Threads or Instagram channels found in Postiz. Connect the profile in Postiz first, then come back
              and refresh — only channels Postiz has authorized can be imported.
            </Notice>
          )}

          {!loading && !error && !!channels.length && (
            <>
              {!importable.length && (
                <Notice tone="ok">Every supported Postiz channel is already imported.</Notice>
              )}
              <ul className="space-y-2">
                {channels.map((c) => {
                  const picked = picks.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                          c.imported
                            ? "cursor-default border-slate-100 bg-slate-50 opacity-70 dark:border-gray-800 dark:bg-gray-800/40"
                            : picked
                              ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                              : "border-slate-200 hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={c.imported || importing}
                          checked={picked}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-indigo-600 dark:border-gray-700"
                        />
                        {c.picture ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={c.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800">
                            <PlatformIcon platform={c.platform} size={15} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800 dark:text-white">
                            {c.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500 dark:text-gray-400">
                            {PROVIDER_LABEL[c.provider] || c.provider}
                            {c.profile ? ` · @${c.profile}` : ""}
                            {c.customer ? ` · ${c.customer}` : ""}
                          </span>
                        </span>
                        {c.imported ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                            <Check size={13} /> Added
                          </span>
                        ) : c.disabled ? (
                          <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                            Disabled in Postiz
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-gray-800">
          <button
            onClick={load}
            disabled={loading || importing}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 dark:text-gray-300 dark:hover:text-white"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800/50"
            >
              Cancel
            </button>
            <button
              onClick={runImport}
              disabled={!picks.length || importing}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing && <Loader2 size={14} className="animate-spin" />}
              {importing ? "Importing…" : `Import${picks.length ? ` ${picks.length}` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Notice({ tone = "warn", children }) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      : tone === "ok"
        ? "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  return (
    <div className={`mb-3 flex gap-2 rounded-lg border p-3 text-sm ${cls}`}>
      {tone !== "ok" && <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs dark:bg-white/10">{children}</code>
  );
}
