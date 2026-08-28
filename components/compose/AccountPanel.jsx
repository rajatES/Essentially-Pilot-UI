"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock, Plus, Search, X } from "lucide-react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";
import AccountAvatar from "@/components/common/AccountAvatar";

// A page an admin has locked (social_accounts.posting_locked). Still connected
// and still reporting analytics — it just can't be a post target, so the
// composer refuses to select it.
const isLocked = (a) => a?.posting_locked === true;

// LEFT panel of the SocialPilot-style composer: searchable account list
// grouped by platform, with per-group select-all and collapsible sections.
export default function AccountPanel({ accounts, selectedIds, onChange, onNavigate, collapsed, onToggleCollapsed }) {
  const [search, setSearch] = useState("");
  const [closedGroups, setClosedGroups] = useState({}); // platform -> true when collapsed

  // A prefilled selection (Duplicate, template, calendar) can name a page that
  // has been locked since. Drop those once `accounts` has actually loaded — the
  // row stays visible below, badged "Locked", so the absence is explained
  // rather than mysterious.
  useEffect(() => {
    if (!accounts.length || !selectedIds.length) return;
    const kept = selectedIds.filter((id) => !isLocked(accounts.find((a) => a.id === id)));
    if (kept.length !== selectedIds.length) onChange(kept);
  }, [accounts, selectedIds, onChange]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? accounts.filter((a) => a.display_name?.toLowerCase().includes(q)) : accounts;
    const order = ["facebook", "instagram", "threads", "twitter", "youtube"];
    const byPlatform = {};
    for (const a of filtered) (byPlatform[a.platform] ||= []).push(a);
    return order.filter((p) => byPlatform[p]?.length).map((p) => ({ platform: p, accounts: byPlatform[p] }));
  }, [accounts, search]);

  const toggle = (id) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  // Select-all of every flavour skips locked pages, so "Select all" can never
  // build a selection the backend will reject.
  const selectableIds = (list) => list.filter((a) => !isLocked(a)).map((a) => a.id);

  const toggleGroup = (group) => {
    const ids = selectableIds(group.accounts);
    if (!ids.length) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));
    onChange(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])]);
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm">
        <button onClick={onToggleCollapsed} title="Expand accounts"
          className="rounded-lg p-2 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800">
          <ChevronRight size={16} />
        </button>
        {groups.map((g) => (
          <div key={g.platform} title={`${PLATFORM_META[g.platform]?.label}: ${g.accounts.filter((a) => selectedIds.includes(a.id)).length}/${g.accounts.filter((a) => !isLocked(a)).length} selected`}
            className="flex flex-col items-center gap-0.5">
            <PlatformIcon platform={g.platform} size={16} />
            <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400">
              {g.accounts.filter((a) => selectedIds.includes(a.id)).length}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-h-[calc(100vh-8rem)] flex-col rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">Accounts</p>
        <div className="flex items-center gap-1">
          {selectedIds.length > 0 && (
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
              {selectedIds.length}
            </span>
          )}
          <button onClick={onToggleCollapsed} title="Collapse panel"
            className="rounded-lg p-1 text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800">
            <ChevronRight size={14} className="rotate-180" />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-100 dark:border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
          <Search size={13} className="text-slate-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"><X size={12} /></button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-0.5 text-xs">
          <button onClick={() => onChange(selectableIds(accounts))} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Select all</button>
          <button onClick={() => onChange([])} className="font-medium text-slate-500 dark:text-gray-400 hover:underline">Clear</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-sm text-slate-400 dark:text-gray-500">
            {accounts.length === 0 ? "No accounts connected yet." : `No accounts match “${search}”.`}
          </p>
        )}
        {groups.map((group) => {
          const meta = PLATFORM_META[group.platform];
          const selCount = group.accounts.filter((a) => selectedIds.includes(a.id)).length;
          const openCount = group.accounts.filter((a) => !isLocked(a)).length;
          const closed = !!closedGroups[group.platform];
          return (
            <div key={group.platform} className="mb-1.5">
              <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5">
                <button
                  onClick={() => setClosedGroups((g) => ({ ...g, [group.platform]: !closed }))}
                  className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
                >
                  {closed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                <input
                  type="checkbox"
                  checked={openCount > 0 && selCount === openCount}
                  ref={(el) => { if (el) el.indeterminate = selCount > 0 && selCount < openCount; }}
                  onChange={() => toggleGroup(group)}
                  disabled={openCount === 0}
                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-gray-700 accent-indigo-600 disabled:opacity-40"
                  title={openCount ? `Select all ${meta?.label} accounts` : `Every ${meta?.label} account is locked`}
                />
                <PlatformIcon platform={group.platform} size={14} />
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400">{meta?.label}</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500">{selCount}/{openCount}</span>
              </div>
              {!closed && group.accounts.map((account) => {
                const locked = isLocked(account);
                return (
                <label
                  key={account.id}
                  title={locked ? `${account.display_name} is locked — posting is turned off. Analytics keep updating; an admin can unlock it in Accounts.` : undefined}
                  className={`ml-4 flex items-center gap-2.5 rounded-lg px-2 py-2 ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50"}`}
                >
                  <input
                    type="checkbox"
                    checked={!locked && selectedIds.includes(account.id)}
                    onChange={() => toggle(account.id)}
                    disabled={locked}
                    className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600 disabled:cursor-not-allowed"
                  />
                  <div className="relative shrink-0">
                    <AccountAvatar account={account} size={28} />
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                      <PlatformIcon platform={account.platform} size={8} />
                    </span>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-gray-100">{account.display_name}</span>
                  {locked && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      <Lock size={9} /> Locked
                    </span>
                  )}
                </label>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 dark:border-gray-800 px-3 py-2">
        <button
          onClick={() => onNavigate("accounts")}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Plus size={12} /> Connect more accounts
        </button>
      </div>
    </div>
  );
}
