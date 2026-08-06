"use client";

import { useMemo, useState } from "react";
import { Facebook, Filter, Link as LinkIcon, Plus, RefreshCw, Search, Tag, Trash2, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsData, usePostsInvalidate, useSports } from "@/lib/queries";
import ConnectAccountsView from "@/components/settings/ConnectAccountsView";
import ManageSportsModal from "@/components/accounts/ManageSportsModal";
import AccountAvatar from "@/components/common/AccountAvatar";

// Accounts hub (Manage + Connect tabs), extracted from app/app/page.js.
// The Facebook JS-SDK connect flow stays in the shell (it owns the SDK and
// the page-selection modal) — passed in via onConnectFacebook / connectBusy.
export default function AccountsView({ me, canManageAccounts, onConnectFacebook, onConnectInstagram, connectBusy, onNavigate }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const { data } = usePostsData();
  const { data: sportsData } = useSports();
  const accounts = useMemo(() => data?.accounts || [], [data]);
  const isAdmin = me?.role === "admin";

  const [accountsTab, setAccountsTab] = useState("manage"); // "connect" | "manage"
  const [acctSearch, setAcctSearch] = useState("");
  const [acctSport, setAcctSport] = useState("all");
  const [acctPlatform, setAcctPlatform] = useState("all");
  const [selectedAccts, setSelectedAccts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [showManageSports, setShowManageSports] = useState(false);

  // Assignable sports = the managed taxonomy plus any category actually in use
  // (so a page never points at an option that isn't listed), with "Other" last.
  const sportOptions = useMemo(() => {
    const managed = (sportsData?.sports || []).map((s) => s.name);
    const seen = new Set();
    const list = [];
    for (const s of [...managed, ...accounts.map((a) => a.category || "Other")]) {
      if (!s || s === "Other" || seen.has(s)) continue;
      seen.add(s);
      list.push(s);
    }
    list.push("Other");
    return list;
  }, [sportsData, accounts]);

  // ── mutations ────────────────────────────────────────────────────────────

  async function disconnectAccount(id) {
    if (!confirm("Disconnect this Page?")) return;
    try {
      await apiJson(`/api/accounts/${id}`, { method: "DELETE" });
      showToast("Page disconnected.");
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Disconnect a whole source Facebook account — removes every page/IG
  // account it granted (same policy as the ES Studio disconnect).
  async function disconnectSourceAccount(fbUserId, name, count) {
    if (!confirm(`Disconnect "${name}" and its ${count} page${count === 1 ? "" : "s"}? Scheduled posts targeting these pages will lose those targets.`)) return;
    try {
      const d = await apiJson("/api/accounts/disconnect", { method: "POST", body: JSON.stringify({ fbUserId }) });
      showToast(`Disconnected ${d.removed} page${d.removed === 1 ? "" : "s"}.`, "ok");
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function syncAccounts(ids) {
    setSyncing(true);
    try {
      const r = await apiJson("/api/accounts/sync", { method: "POST", body: JSON.stringify({ ids: ids || null }) });
      const failed = (r.results || []).filter((x) => !x.ok).length;
      showToast(failed ? `Synced with ${failed} token issue(s).` : "Accounts synced.", failed ? "warn" : "ok");
      invalidatePosts();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  }

  async function bulkAccount(action, value) {
    if (!selectedAccts.length) { showToast("Select accounts first.", "warn"); return; }
    if (action === "disconnect" && !confirm(`Disconnect ${selectedAccts.length} account(s)?`)) return;
    try {
      await apiJson("/api/accounts/bulk", { method: "POST", body: JSON.stringify({ action, ids: selectedAccts, value }) });
      setSelectedAccts([]);
      showToast("Bulk action applied.");
      invalidatePosts();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function updateCategory(accountId, category) {
    try {
      await apiJson(`/api/accounts/${accountId}`, { method: "PATCH", body: JSON.stringify({ category }) });
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Publish health. `publishing_ok` is now set by real signals — a failed
  // publish attributed to the account, or the CREATE_CONTENT probe in
  // /api/accounts/sync — so "Reconnect needed" means the page genuinely can't
  // post right now. metadata.auth_error carries Meta's own wording.
  function tokenHealth(a) {
    const reason = a.metadata?.auth_error?.message || null;
    if (a.publishing_ok === false) {
      return {
        label: "Reconnect needed",
        reason,
        cls: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
      };
    }
    if (a.token_expires_at) {
      const days = (new Date(a.token_expires_at).getTime() - Date.now()) / 86400000;
      if (days < 0) return { label: "Expired", reason, cls: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" };
      if (days < 7) return { label: `Expires ${Math.ceil(days)}d`, reason, cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    }
    return { label: "Healthy", reason: null, cls: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" };
  }

  // ── derived data ─────────────────────────────────────────────────────────

  // Group connected pages by the FB account that granted them (multi-account
  // support). Pages connected before grantor tracking fall under "legacy".
  const accountsBySource = useMemo(() => {
    const map = {};
    for (const a of accounts) {
      const via = a.metadata?.connected_via;
      const key = via?.fb_user_id || "legacy";
      if (!map[key]) {
        map[key] = {
          fbUserId: key,
          name: via?.fb_user_name || "Earlier connection",
          avatar: via?.avatar || null,
          pages: [],
          broken: []
        };
      }
      map[key].pages.push(a);
      // Meta restrictions and revoked sessions attach to the GRANTOR, so when a
      // token dies every page that account granted usually dies together.
      // Counting them here is what turns "one page mysteriously fails" into
      // "this Facebook account needs re-authing".
      if (a.publishing_ok === false) map[key].broken.push(a);
    }
    return Object.values(map);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesText = !q || a.display_name?.toLowerCase().includes(q);
      const matchesSport = acctSport === "all" || (a.category || "Other") === acctSport;
      const matchesPlatform = acctPlatform === "all" || a.platform === acctPlatform;
      return matchesText && matchesSport && matchesPlatform;
    });
  }, [accounts, acctSearch, acctSport, acctPlatform]);

  const platformCounts = useMemo(() => {
    const counts = {};
    for (const a of accounts) counts[a.platform] = (counts[a.platform] || 0) + 1;
    return counts;
  }, [accounts]);

  // Primary grouping: platform sections (SocialPilot-style); the sport filter
  // narrows within them.
  const accountsByPlatform = useMemo(() => {
    const groups = {};
    for (const a of filteredAccounts) {
      (groups[a.platform] ||= []).push(a);
    }
    return groups;
  }, [filteredAccounts]);
  const PLATFORM_ORDER = ["facebook", "instagram", "threads", "twitter", "youtube"];

  const sportCounts = useMemo(() => {
    const counts = {};
    for (const a of accounts) {
      const key = a.category || "Other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [accounts]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex gap-2 border-b border-slate-200 dark:border-gray-800">
        <button
          onClick={() => setAccountsTab("manage")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${accountsTab === "manage" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
        >
          Manage Accounts
        </button>
        {/* Everyone can reach the Connect tab; non-admins see an Instagram + YouTube-only view. */}
        <button
          onClick={() => setAccountsTab("connect")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${accountsTab === "connect" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
        >
          Connect Accounts
        </button>
      </div>

      {accountsTab === "connect" && (
        <ConnectAccountsView
          onConnectMeta={canManageAccounts ? onConnectFacebook : undefined}
          onConnectInstagram={onConnectInstagram}
          canManageAccounts={canManageAccounts}
        />
      )}

      {accountsTab === "manage" && (
      <div className="mx-auto max-w-4xl space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-800 dark:text-white">Manage Accounts</p>
          <p className="text-sm text-slate-500 dark:text-gray-400">{accounts.length} page{accounts.length !== 1 ? "s" : ""} connected across {Object.keys(sportCounts).length} sport{Object.keys(sportCounts).length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("compose")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50"
          >
            <Plus size={15} /> Create Post
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowManageSports(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50"
            >
              <Tag size={15} /> Manage sports
            </button>
          )}
          {accounts.length > 0 && (
            <button
              onClick={() => syncAccounts(null)}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Sync all
            </button>
          )}
          {canManageAccounts && (
            <button
              onClick={() => setAccountsTab("connect")}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <LinkIcon size={15} /> Connect Pages
            </button>
          )}
        </div>
      </div>

      {/* Source accounts — pages grouped by the FB account that granted them */}
      {accounts.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
            <p className="text-sm font-bold text-slate-700 dark:text-gray-200">Connected Facebook accounts</p>
            {canManageAccounts && (
              <button
                onClick={() => onConnectFacebook(true)}
                disabled={connectBusy}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                title="Sign in with a different Facebook account to add its pages"
              >
                <Plus size={13} /> Connect another account
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {accountsBySource.map((src) => (
              <div key={src.fbUserId} className="flex items-center gap-3 px-4 py-2.5">
                {src.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={src.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
                    <Facebook size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{src.name}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {src.pages.length} page{src.pages.length !== 1 ? "s" : ""}
                    {src.fbUserId === "legacy" && " · connected before account tracking"}
                  </p>
                  {src.broken.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {src.broken.length} of {src.pages.length} can&apos;t publish
                      {src.broken.length === src.pages.length && src.pages.length > 1
                        ? " — this Facebook account's access has lapsed; reconnect it"
                        : " — reconnect to restore"}
                    </p>
                  )}
                </div>
                {canManageAccounts && src.broken.length > 0 && (
                  <button
                    onClick={() => onConnectFacebook(true)}
                    disabled={connectBusy}
                    className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    title={`Sign in as ${src.name} again to mint fresh page tokens`}
                  >
                    Reconnect
                  </button>
                )}
                {canManageAccounts && (
                  <button
                    onClick={() => disconnectSourceAccount(src.fbUserId, src.name, src.pages.length)}
                    className="rounded-lg border border-red-200 dark:border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    Disconnect account
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              While the Meta app is in development mode, each Facebook account used here must be added as a <strong>Tester</strong> in the Meta dashboard (App Roles) before it can connect.
            </p>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
          <Facebook size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No Pages connected yet</p>
          {canManageAccounts ? (
            <>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                Click <strong>Connect Pages</strong>. In the Facebook popup, <strong>check your Page(s)</strong> before saving.
              </p>
              <button
                onClick={() => onConnectFacebook(false)}
                disabled={connectBusy}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Facebook size={15} /> Connect now
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
              Ask an admin or your division's Group Head to connect a Page.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
              <Search size={14} className="text-slate-400 dark:text-gray-500" />
              <input
                value={acctSearch}
                onChange={(e) => setAcctSearch(e.target.value)}
                placeholder="Search pages…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
              />
              {acctSearch && (
                <button onClick={() => setAcctSearch("")} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"><X size={13} /></button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PlatformIcon platform={acctPlatform === "all" ? "facebook" : acctPlatform} size={14} />
              <select
                value={acctPlatform}
                onChange={(e) => setAcctPlatform(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">All platforms ({accounts.length})</option>
                {Object.keys(platformCounts).map((p) => (
                  <option key={p} value={p}>{PLATFORM_META[p]?.label || p} ({platformCounts[p]})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400 dark:text-gray-500" />
              <select
                value={acctSport}
                onChange={(e) => setAcctSport(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
              >
                <option value="all">All sports ({accounts.length})</option>
                {sportOptions.filter((s) => sportCounts[s]).map((s) => (
                  <option key={s} value={s}>{s} ({sportCounts[s]})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedAccts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5">
              <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{selectedAccts.length} selected</span>
              <button onClick={() => syncAccounts(selectedAccts)} className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">Sync</button>
              {canManageAccounts && (
                <>
                  <select onChange={(e) => { if (e.target.value) { bulkAccount("category", e.target.value); e.target.value = ""; } }}
                    className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 outline-none" defaultValue="">
                    <option value="" disabled>Set sport…</option>
                    {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => bulkAccount("disconnect")} className="rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">Disconnect</button>
                </>
              )}
              <button onClick={() => setSelectedAccts([])} className="ml-auto text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline">Clear</button>
            </div>
          )}

          {/* Platform groups */}
          {Object.keys(accountsByPlatform).length === 0 ? (
            <p className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">
              No pages match your filter.
            </p>
          ) : (
            PLATFORM_ORDER.filter((p) => accountsByPlatform[p]).map((platform) => (
              <div key={platform} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-gray-200">
                    <PlatformIcon platform={platform} size={15} /> {PLATFORM_META[platform]?.label || platform}
                  </p>
                  <span className="text-xs text-slate-400 dark:text-gray-500">{accountsByPlatform[platform].length} account{accountsByPlatform[platform].length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-gray-800">
                  {accountsByPlatform[platform].map((account) => {
                    const health = tokenHealth(account);
                    return (
                    <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedAccts.includes(account.id)}
                        onChange={() => setSelectedAccts((p) => p.includes(account.id) ? p.filter((x) => x !== account.id) : [...p, account.id])}
                        className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                      />
                      <div className="relative">
                        <AccountAvatar account={account} size={36} />
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                          <PlatformIcon platform={account.platform} size={9} />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-white truncate">{account.display_name}</p>
                        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                          {PLATFORM_META[account.platform]?.label || account.platform}
                          {account.followers != null && <span>· {account.followers.toLocaleString()} followers</span>}
                          {account.page_likes != null && <span>· {account.page_likes.toLocaleString()} likes</span>}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.cls}`}
                        title={
                          health.reason
                            ? `${health.reason}\n\nReconnecting this page usually clears it.`
                            : account.last_synced_at
                              ? `Last sync ${new Date(account.last_synced_at).toLocaleString()}`
                              : "Not synced yet"
                        }
                      >
                        {health.label}
                      </span>
                      {canManageAccounts ? (
                        <select
                          value={account.category || "Other"}
                          onChange={(e) => updateCategory(account.id, e.target.value)}
                          className="rounded-lg border border-slate-200 dark:border-gray-800 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                          title="Change sport"
                        >
                          {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-gray-400">{account.category || "Other"}</span>
                      )}
                      {canManageAccounts && (
                        <button
                          onClick={() => disconnectAccount(account.id)}
                          className="rounded-lg border border-red-200 dark:border-red-500/30 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          title="Disconnect"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
      </div>
      )}

      {showManageSports && <ManageSportsModal onClose={() => setShowManageSports(false)} />}
    </div>
  );
}
