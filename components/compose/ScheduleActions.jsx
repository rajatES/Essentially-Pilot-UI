"use client";

import { CalendarClock, FastForward, FileText, LayoutList, RefreshCw, Send, ShieldCheck, Zap } from "lucide-react";

// Footer of the content space: SocialPilot's scheduling actions.
//   Share Now · Share Next (next open queue slot) · Add to Queue · Schedule
// plus Save Draft / Submit for Review. The date+time picker shows for
// Schedule mode only (same 5-min-slot control as before).
const MODES = [
  { id: "now",      label: "Share Now",    Icon: Zap },
  { id: "next",     label: "Share Next",   Icon: FastForward },
  { id: "queue",    label: "Add to Queue", Icon: LayoutList },
  { id: "schedule", label: "Schedule",     Icon: CalendarClock },
];

export default function ScheduleActions({
  mode, onModeChange, scheduledFor, onScheduledForChange,
  onSubmit, onSaveDraft, onSubmitReview, onNavigate,
  saving, ctaDisabled, ctaDisabledReason,
}) {
  return (
    <div className="space-y-4">
      {/* mode selector */}
      <div className="flex flex-wrap gap-2">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onModeChange(id)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              mode === id
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {(mode === "queue" || mode === "next") && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-700 dark:text-indigo-300">
          <LayoutList size={15} className="shrink-0" />
          {mode === "next"
            ? <>Publishes in the <strong>next open queue slot</strong> for the selected pages.</>
            : <>Will be scheduled into the next open queue slot — manage slots under{" "}
                <button type="button" onClick={() => onNavigate("queues")} className="font-semibold underline">Posting Queue</button>.</>}
        </div>
      )}

      {mode === "schedule" && <ScheduleTimePicker scheduledFor={scheduledFor} onChange={onScheduledForChange} />}

      {/* primary CTA */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || ctaDisabled}
        title={ctaDisabled ? ctaDisabledReason : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? <RefreshCw size={16} className="animate-spin" /> : mode === "now" ? <Zap size={16} /> : <Send size={16} />}
        {saving ? "Publishing…"
          : mode === "now" ? "Share Now"
          : mode === "next" ? "Share Next"
          : mode === "queue" ? "Add to Queue"
          : "Schedule Post"}
      </button>

      {/* secondary actions */}
      <div className="flex gap-2">
        <button type="button" onClick={onSaveDraft} disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50">
          <FileText size={15} /> Save draft
        </button>
        <button type="button" onClick={onSubmitReview} disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
          <ShieldCheck size={15} /> Submit for review
        </button>
      </div>
    </div>
  );
}

// The 5-min-slot date+time control, ported from the old composer.
function ScheduleTimePicker({ scheduledFor, onChange }) {
  // Split scheduledFor "YYYY-MM-DDTHH:MM" into date + time parts
  const sfDate = scheduledFor ? scheduledFor.slice(0, 10) : "";
  const sfTime = scheduledFor ? scheduledFor.slice(11, 16) : "";

  // Today's date string in local time
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const maxDateStr = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 30);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  })();

  // Generate 5-min slots for the day
  const allSlots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      allSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  // If today selected, only show future slots (>= now + 5 min)
  const isToday = sfDate === todayStr;
  const minTime = (() => {
    const cutoff = new Date(now.getTime() + 5 * 60000);
    return `${String(cutoff.getHours()).padStart(2, "0")}:${String(Math.ceil(cutoff.getMinutes() / 30) * 30 === 60 ? 0 : Math.ceil(cutoff.getMinutes() / 30) * 30).padStart(2, "0")}`;
  })();
  const slots = isToday ? allSlots.filter((s) => s >= minTime) : allSlots;

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    // If switching to today and current time is in the past, pick first valid slot
    const isNewToday = newDate === todayStr;
    let newTime = sfTime;
    if (isNewToday && sfTime < minTime) {
      newTime = slots[0] || minTime;
    }
    onChange(newDate && newTime ? `${newDate}T${newTime}` : "");
  };

  const fmtSlot = (t) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-200">
        Schedule date &amp; time
      </label>
      <div className="flex gap-2">
        <input
          type="date"
          value={sfDate}
          min={todayStr}
          max={maxDateStr}
          onChange={handleDateChange}
          className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 outline-none focus:border-indigo-500"
          required
        />
        <select
          value={sfTime}
          onChange={(e) => onChange(sfDate ? `${sfDate}T${e.target.value}` : "")}
          disabled={!sfDate}
          size={1}
          className="w-36 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 outline-none focus:border-indigo-500 disabled:opacity-40"
          required
        >
          {!sfTime && <option value="">Time</option>}
          {slots.map((s) => (
            <option key={s} value={s}>{fmtSlot(s)}</option>
          ))}
        </select>
      </div>
      {slots.length === 0 && sfDate === todayStr && (
        <p className="mt-1.5 text-xs text-amber-500">No more slots today — pick tomorrow.</p>
      )}
      <p className="mt-1.5 text-xs text-slate-400 dark:text-gray-500">
        Up to 30 days ahead. A time within ~10 min posts immediately.
      </p>
    </div>
  );
}
