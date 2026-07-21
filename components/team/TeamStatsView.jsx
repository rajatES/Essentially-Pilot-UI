"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { apiJson as jsonFetch } from "@/lib/apiClient";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = {
  today: () => { const d = new Date(); return { from: toISODate(d), to: toISODate(d) }; },
  "7d": () => { const to = new Date(); const from = new Date(to.getTime() - 6 * 86400000); return { from: toISODate(from), to: toISODate(to) }; },
  "30d": () => { const to = new Date(); const from = new Date(to.getTime() - 29 * 86400000); return { from: toISODate(from), to: toISODate(to) }; }
};

export default function TeamStatsView() {
  const [preset, setPreset] = useState("7d");
  const [range, setRange] = useState(PRESETS["7d"]());
  const [divisionId, setDivisionId] = useState("");

  function applyPreset(p) {
    setPreset(p);
    if (PRESETS[p]) setRange(PRESETS[p]());
  }

  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (divisionId) params.set("divisionId", divisionId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["team-stats", range.from, range.to, divisionId],
    queryFn: () => jsonFetch(`/api/team/stats?${params.toString()}`)
  });

  const divisions = data?.allDivisions || [];
  const divisionRows = data?.divisions || [];
  const associateRows = data?.associates || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-gray-700">
          {[["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]].map(([key, label]) => (
            <button key={key} onClick={() => applyPreset(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${preset === key ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="date" value={range.from} onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
          className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        <span className="text-xs text-slate-400 dark:text-gray-500">to</span>
        <input type="date" value={range.to} onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
          className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
          <option value="">All divisions</option>
          {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error.message}</p>}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-x-auto">
            <p className="border-b border-slate-100 dark:border-gray-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200">By division</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 text-left text-xs text-slate-400 dark:text-gray-500">
                  <th className="px-4 py-2 font-medium">Division</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Infographic</th>
                  <th className="px-4 py-2 font-medium">Meme/Image</th>
                  <th className="px-4 py-2 font-medium">LIC</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">vs Target</th>
                </tr>
              </thead>
              <tbody>
                {divisionRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-gray-500">No posts in this range.</td></tr>
                ) : divisionRows.map((d) => (
                  <tr key={d.divisionId || "unassigned"} className="border-b border-slate-50 dark:border-gray-800 last:border-0 text-slate-600 dark:text-gray-300">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-white">{d.divisionName}</td>
                    <td className="px-4 py-2">{d.total}</td>
                    <td className="px-4 py-2">{d.infographic}</td>
                    <td className="px-4 py-2">{d.meme_image}</td>
                    <td className="px-4 py-2">{d.lic}</td>
                    <td className="px-4 py-2 text-slate-400 dark:text-gray-500">{d.dailyTarget ?? "—"}</td>
                    <td className={`px-4 py-2 ${d.dailyTarget && d.total < d.dailyTarget ? "text-red-600 dark:text-red-300" : "text-green-600 dark:text-green-300"}`}>
                      {d.dailyTarget ? d.total - d.dailyTarget : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-x-auto">
            <p className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200">
              <BarChart3 size={15} /> By associate
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 text-left text-xs text-slate-400 dark:text-gray-500">
                  <th className="px-4 py-2 font-medium">Associate</th>
                  <th className="px-4 py-2 font-medium">Division</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Infographic</th>
                  <th className="px-4 py-2 font-medium">Meme/Image</th>
                  <th className="px-4 py-2 font-medium">LIC</th>
                  <th className="px-4 py-2 font-medium">Untagged</th>
                </tr>
              </thead>
              <tbody>
                {associateRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-gray-500">No posts in this range.</td></tr>
                ) : associateRows.map((a) => (
                  <tr key={a.profileId} className="border-b border-slate-50 dark:border-gray-800 last:border-0 text-slate-600 dark:text-gray-300">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-white">{a.displayName}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-gray-400">{a.divisionName}</td>
                    <td className="px-4 py-2">{a.total}</td>
                    <td className="px-4 py-2">{a.infographic}</td>
                    <td className="px-4 py-2">{a.meme_image}</td>
                    <td className="px-4 py-2">{a.lic}</td>
                    <td className="px-4 py-2 text-slate-400 dark:text-gray-500">{a.untagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
