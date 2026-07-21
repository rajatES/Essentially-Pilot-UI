"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await apiFetch("/api/notifications");
      return r.json();
    },
    refetchInterval: 60_000
  });

  const unread = data?.unread || 0;
  const items = data?.notifications || [];

  async function markAll() {
    await apiFetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 transition-colors hover:bg-slate-50 dark:hover:bg-gray-800">
        <Bell size={16} className="text-slate-500 dark:text-gray-400" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-80 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-3 py-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Notifications</p>
              {unread > 0 && <button onClick={markAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-400 dark:text-gray-500">You&apos;re all caught up 🎉</p>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={`border-b border-slate-50 dark:border-gray-800 px-3 py-2 ${n.read ? "" : "bg-indigo-50/60 dark:bg-indigo-500/10"}`}>
                    <p className="text-sm text-slate-700 dark:text-gray-200">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-400 dark:text-gray-500">{n.body}</p>}
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
