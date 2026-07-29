"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, Trash2 } from "lucide-react";
import { apiJson } from "@/lib/apiClient";

// Developer API keys (Settings) — admin-only. Backend: /api/api-keys.
// The full key is displayed exactly once, right after creation; afterwards
// only the prefix is shown. Keys authenticate the external /api/v1/* surface.
export default function ApiKeysSection() {
  const [keys, setKeys] = useState(null); // null = loading or not allowed
  const [usageById, setUsageById] = useState({}); // keyId → { total, lastPostAt, ... }
  const [allowed, setAllowed] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null); // { name, key } shown once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null); // two-step revoke

  async function refresh() {
    try {
      // Key rows + per-key usage rollups (posts created via this key).
      const [d, u] = await Promise.all([
        apiJson("/api/api-keys"),
        apiJson("/api/api-keys/usage").catch(() => ({ usage: [] })),
      ]);
      setKeys(d.keys || []);
      setUsageById(Object.fromEntries((u.usage || []).map((x) => [x.id, x])));
      setAllowed(true);
    } catch {
      // 403 for non-admins — hide the whole section.
      setAllowed(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  if (!allowed) return null;

  async function createKey() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const d = await apiJson("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setNewKey({ name: d.name, key: d.key });
      setName("");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  // Two-step inline confirm (no window.confirm — blocked in some environments):
  // first click arms the button, second click revokes.
  async function revoke(id) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      setTimeout(() => setConfirmingId((c) => (c === id ? null : c)), 4000);
      return;
    }
    setConfirmingId(null);
    try {
      await apiJson(`/api/api-keys/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  }

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="border-b border-slate-100 dark:border-gray-800 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
          <KeyRound size={15} /> Developer API keys
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-500">
          Connect external tools and automations to the posting API (/api/v1). Keys are shown once — store them safely.
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* One-time reveal after creating a key */}
        {newKey && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Key for “{newKey.name}” — copy it now, it won't be shown again:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-white dark:bg-gray-950 border border-amber-200 dark:border-amber-500/30 px-2 py-1.5 text-xs text-slate-800 dark:text-gray-100">
                {newKey.key}
              </code>
              <button
                onClick={copyKey}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => setNewKey(null)}
                className="rounded-lg border border-amber-300 dark:border-amber-500/40 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Create */}
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
            placeholder='Key name, e.g. "n8n automation"'
            className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={createKey}
            disabled={!name.trim() || creating}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus size={15} /> {creating ? "Creating…" : "Create key"}
          </button>
        </div>
        {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        {/* List */}
        {keys === null ? (
          <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-gray-800" />
        ) : keys.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-gray-500">No API keys yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-gray-800 rounded-lg border border-slate-100 dark:border-gray-800">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-gray-200">
                    {k.name}
                    {k.revoked_at && (
                      <span className="ml-2 rounded bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                        REVOKED
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">
                    <code>{k.key_prefix}</code> · created {fmt(k.created_at)} · last used {fmt(k.last_used_at)}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-400">
                    {(usageById[k.id]?.total ?? 0)} post{(usageById[k.id]?.total ?? 0) === 1 ? "" : "s"} created
                    {usageById[k.id]?.lastPostAt ? ` · last ${fmt(usageById[k.id].lastPostAt)}` : ""}
                  </p>
                </div>
                {!k.revoked_at &&
                  (confirmingId === k.id ? (
                    <button
                      onClick={() => revoke(k.id)}
                      className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirm revoke?
                    </button>
                  ) : (
                    <button
                      onClick={() => revoke(k.id)}
                      title="Revoke key"
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
