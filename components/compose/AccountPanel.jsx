"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search, X } from "lucide-react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

// LEFT panel of the SocialPilot-style composer: searchable account list
// grouped by platform, with per-group select-all and collapsible sections.
export default function AccountPanel({ accounts, selectedIds, onChange, onNavigate, collapsed, onToggleCollapsed }) {
  const [search, setSearch] = useState("");
  const [closedGroups, setClosedGroups] = useState({}); // platform -> true when collapsed

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

  const toggleGroup = (group) => {
    const ids = group.accounts.map((a) => a.id);
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
          <div key={g.platform} title={`${PLATFORM_META[g.platform]?.label}: ${g.accounts.filter((a) => selectedIds.includes(a.id)).length}/${g.accounts.length} selected`}
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
          <button onClick={() => onChange(accounts.map((a) => a.id))} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Select all</button>
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
                  checked={selCount === group.accounts.length}
                  ref={(el) => { if (el) el.indeterminate = selCount > 0 && selCount < group.accounts.length; }}
                  onChange={() => toggleGroup(group)}
                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                  title={`Select all ${meta?.label} accounts`}
                />
                <PlatformIcon platform={group.platform} size={14} />
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400">{meta?.label}</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500">{selCount}/{group.accounts.length}</span>
              </div>
              {!closed && group.accounts.map((account) => (
                <label key={account.id} className="ml-4 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(account.id)}
                    onChange={() => toggle(account.id)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                  />
                  <div className="relative shrink-0">
                    {account.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={account.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${meta?.bg || "bg-indigo-100 dark:bg-indigo-500/20"}`}>
                        <PlatformIcon platform={account.platform} size={13} />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                      <PlatformIcon platform={account.platform} size={8} />
                    </span>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-gray-100">{account.display_name}</span>
                </label>
              ))}
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
