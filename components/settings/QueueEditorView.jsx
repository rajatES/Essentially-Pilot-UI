"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, X, Save } from "lucide-react";
import { apiJson } from "@/lib/apiClient";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Per-account weekly posting queue editor. "Add to Queue" in the composer
// schedules into the earliest open slot defined here.
export default function QueueEditorView({ accounts }) {
  const [slots, setSlots] = useState([]);            // all accounts' slots from the API
  const [timezone, setTimezone] = useState("UTC");
  const [selectedId, setSelectedId] = useState("");  // account being edited
  const [draft, setDraft] = useState([]);            // working copy [{weekday, time_of_day}]
  const [newDay, setNewDay] = useState(1);
  const [newTime, setNewTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const connectable = useMemo(() => accounts || [], [accounts]);

  useEffect(() => {
    apiJson("/api/queues")
      .then((d) => { setSlots(d.slots || []); setTimezone(d.timezone || "UTC"); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load the working copy when the account changes.
  useEffect(() => {
    if (!selectedId) { setDraft([]); return; }
    setDraft(
      slots
        .filter((s) => s.social_account_id === selectedId)
        .map((s) => ({ weekday: s.weekday, time_of_day: String(s.time_of_day).slice(0, 5) })),
    );
  }, [selectedId, slots]);

  function addSlot(weekday, time) {
    const t = String(time).slice(0, 5);
    if (draft.some((s) => s.weekday === weekday && s.time_of_day === t)) return;
    setDraft((prev) => [...prev, { weekday, time_of_day: t }].sort((a, b) => a.weekday - b.weekday || a.time_of_day.localeCompare(b.time_of_day)));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const d = await apiJson(`/api/queues/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ slots: draft.map((s) => ({ weekday: s.weekday, time: s.time_of_day })) }),
      });
      setSlots(d.slots || []);
      setMsg({ type: "ok", text: "Queue saved." });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  const slotCountFor = (accountId) => slots.filter((s) => s.social_account_id === accountId).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Posting Queue</h2>
        <p className="mt-1 text-slate-600 dark:text-gray-300">
          Weekly time slots per page — &ldquo;Add to Queue&rdquo; drops a post into the next open slot. Times are in <span className="font-semibold">{timezone}</span>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Account list */}
          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Pages</p>
            <div className="space-y-1 max-h-[26rem] overflow-y-auto">
              {connectable.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === a.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.avatar_url ? <img src={a.avatar_url} alt="" className="h-6 w-6 rounded-full" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-gray-700 text-[10px]">{a.display_name?.[0]}</span>}
                  <span className="min-w-0 flex-1 truncate">{a.display_name}</span>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">{slotCountFor(a.id)}</span>
                </button>
              ))}
              {!connectable.length && <p className="px-2 py-4 text-sm text-slate-400 dark:text-gray-500">Connect accounts first.</p>}
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedId ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-gray-700 text-sm text-slate-400 dark:text-gray-500">
                Pick a page to edit its queue.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white"><Clock size={15} /> Weekly slots</p>
                    <button onClick={save} disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Save size={14} /> {saving ? "Saving…" : "Save queue"}
                    </button>
                  </div>

                  {/* Slot chips grouped by weekday */}
                  <div className="space-y-2">
                    {WEEKDAYS.map((name, day) => {
                      const daySlots = draft.filter((s) => s.weekday === day);
                      return (
                        <div key={day} className="flex items-start gap-3">
                          <span className="w-10 shrink-0 pt-1 text-xs font-semibold text-slate-400 dark:text-gray-500">{name}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {daySlots.length ? daySlots.map((s) => (
                              <span key={`${day}-${s.time_of_day}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                                {s.time_of_day}
                                <button onClick={() => setDraft((prev) => prev.filter((x) => !(x.weekday === day && x.time_of_day === s.time_of_day)))} className="hover:text-red-500"><X size={11} /></button>
                              </span>
                            )) : <span className="pt-1 text-xs text-slate-300 dark:text-gray-600">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add slot */}
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 dark:border-gray-800 pt-3">
                    <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm">
                      {WEEKDAYS.map((n, i) => <option key={i} value={i}>{n}</option>)}
                    </select>
                    <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
                    <button onClick={() => addSlot(newDay, newTime)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                      <Plus size={14} /> Add slot
                    </button>
                  </div>

                  {msg && <p className={`mt-2 text-sm ${msg.type === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
