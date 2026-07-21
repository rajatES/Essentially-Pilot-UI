"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, UserPlus, Trash2, ShieldCheck, X, UserCheck, UserX, BarChart3 } from "lucide-react";
import TeamStatsView from "@/components/team/TeamStatsView";
import { apiJson as jsonFetch } from "@/lib/apiClient";

export default function TeamView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["team"], queryFn: () => jsonFetch("/api/team") });
  const [tab, setTab] = useState("roster"); // "roster" | "stats"
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "member", divisionId: "", isGroupHead: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const allTeam = data?.team || [];
  const team = allTeam.filter((t) => t.status !== "pending");
  const pending = allTeam.filter((t) => t.status === "pending");
  const divisions = data?.divisions || [];
  const divisionName = (id) => divisions.find((d) => d.id === id)?.name || "—";
  const me = data?.me;
  const isAdmin = me?.role === "admin";

  async function invite() {
    setError("");
    if (!form.displayName.trim() || !form.email.trim() || form.password.length < 8) {
      setError("Name, email, and an 8+ character password are required.");
      return;
    }
    setBusy(true);
    try {
      await jsonFetch("/api/team", { method: "POST", body: JSON.stringify(form) });
      setShowNew(false);
      setForm({ displayName: "", email: "", password: "", role: "member", divisionId: "", isGroupHead: false });
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id, role) {
    await jsonFetch(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function changeDivision(id, divisionId) {
    await jsonFetch(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify({ divisionId }) });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function toggleGroupHead(id, isGroupHead) {
    await jsonFetch(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify({ isGroupHead }) });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function approve(id) {
    await jsonFetch(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function reject(id, name) {
    if (!confirm(`Reject ${name}'s access request? This removes their account entirely.`)) return;
    await jsonFetch(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function remove(id, name) {
    if (!confirm(`Remove ${name}'s seat? Their posts stay, but they'll lose access immediately.`)) return;
    await jsonFetch(`/api/team/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white"><Users size={20} /> Team</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Everyone shares the same Pages and posts — this just tracks who did what.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            <UserPlus size={15} /> Add teammate
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-gray-800">
        <button onClick={() => setTab("roster")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === "roster" ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}>
          Roster
        </button>
        <button onClick={() => setTab("stats")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === "stats" ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}>
          <BarChart3 size={14} /> Stats
        </button>
      </div>

      {tab === "stats" && <TeamStatsView />}

      {tab === "roster" && isAdmin && pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 shadow-sm">
          <p className="border-b border-amber-200 dark:border-amber-500/30 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            Pending requests ({pending.length})
          </p>
          <div className="divide-y divide-amber-100 dark:divide-amber-500/20">
            {pending.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{t.display_name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">{t.email} · requested {divisionName(t.division_id)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => approve(t.id)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                    <UserCheck size={13} /> Approve
                  </button>
                  <button onClick={() => reject(t.id, t.display_name)} className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <UserX size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "roster" && (isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />)}</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-gray-800 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          {team.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                  {t.display_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{t.display_name} {t.id === me?.id && <span className="text-xs text-slate-400 dark:text-gray-500">(you)</span>}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">{t.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin ? (
                  <select value={t.division_id || ""} onChange={(e) => changeDivision(t.id, e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                    <option value="">No division</option>
                    {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-gray-400">{divisionName(t.division_id)}</span>
                )}
                {isAdmin ? (
                  <select value={t.role} onChange={(e) => changeRole(t.id, e.target.value)} disabled={t.id === me?.id}
                    className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t.role === "admin" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {t.role === "admin" && <ShieldCheck size={11} />} {t.role}
                  </span>
                )}
                {isAdmin ? (
                  <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs text-slate-600 dark:text-gray-300">
                    <input type="checkbox" checked={!!t.is_group_head} onChange={(e) => toggleGroupHead(t.id, e.target.checked)} className="accent-indigo-600" />
                    GH
                  </label>
                ) : t.is_group_head ? (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">Group Head</span>
                ) : null}
                {isAdmin && t.id !== me?.id && (
                  <button onClick={() => remove(t.id, t.display_name)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <p className="font-semibold text-slate-800 dark:text-white">Add teammate</p>
              <button onClick={() => setShowNew(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <input autoFocus value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Full name"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (8+ characters)"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <select value={form.divisionId} onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                <option value="">No division</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                <input type="checkbox" checked={form.isGroupHead} onChange={(e) => setForm({ ...form, isGroupHead: e.target.checked })} className="accent-indigo-600" />
                Group Head of this division (can approve/reject that division's pending posts)
              </label>
              <p className="text-xs text-slate-400 dark:text-gray-500">Share this password with them directly — there's no invite email. They can sign in right away.</p>
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-gray-800 px-5 py-3">
              <button onClick={() => setShowNew(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={invite} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {busy ? "Adding…" : "Add teammate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
