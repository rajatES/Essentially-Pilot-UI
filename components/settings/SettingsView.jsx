"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Save, Settings as SettingsIcon } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import ApiKeysSection from "./ApiKeysSection";

const DEFAULTS = {
  darkMode: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  defaultHashtags: "",
  defaultFirstComment: "",
  defaultLinkInFirstComment: false,
  utmTracking: false,
  autoRecycle: false,
  autoApprove: false,
  autoApproveHours: 24
};

export function applyDarkMode(on) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", !!on);
}

export default function SettingsView() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const merged = { ...DEFAULTS, ...(d.settings || {}) };
        setSettings(merged);
        applyDarkMode(merged.darkMode);
      })
      .finally(() => setLoading(false));
  }, []);

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
    if (key === "darkMode") applyDarkMode(value);
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      localStorage.setItem("app-settings", JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl"><div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white"><SettingsIcon size={20} /> Settings</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400">Appearance, defaults, and preferences</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme" desc="Switch between light and dark mode">
          <div className="flex gap-2">
            <button onClick={() => update("darkMode", false)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${!settings.darkMode ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300"}`}>
              <Sun size={15} /> Light
            </button>
            <button onClick={() => update("darkMode", true)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${settings.darkMode ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300"}`}>
              <Moon size={15} /> Dark
            </button>
          </div>
        </Row>
      </Section>

      {/* Posting defaults */}
      <Section title="Posting defaults">
        <Row label="Timezone" desc="Used for scheduling display">
          <input value={settings.timezone} onChange={(e) => update("timezone", e.target.value)}
            className="w-56 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        </Row>
        <Row label="Default hashtags" desc="Auto-appended suggestion in composer">
          <input value={settings.defaultHashtags} onChange={(e) => update("defaultHashtags", e.target.value)} placeholder="#Sports #ES"
            className="w-56 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        </Row>
        <Row label="Default first comment" desc="Prefilled first-comment text">
          <input value={settings.defaultFirstComment} onChange={(e) => update("defaultFirstComment", e.target.value)}
            className="w-56 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        </Row>
        <Row label="Link in first comment" desc="Auto-append the post's link to the first comment instead of the caption">
          <input type="checkbox" checked={settings.defaultLinkInFirstComment} onChange={(e) => update("defaultLinkInFirstComment", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
        </Row>
      </Section>

      {/* Analytics & automation */}
      <Section title="Analytics & automation">
        <Row label="UTM click tracking" desc="Tag outbound links with utm_source / utm_medium / utm_campaign (one campaign per post) so clicks show up in Google Analytics">
          <input type="checkbox" checked={settings.utmTracking} onChange={(e) => update("utmTracking", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
        </Row>
        <Row label="Auto-recycle top performer" desc="When the next 24h queue is empty, automatically re-queue your best post from the last 30 days (never the same content twice in a week)">
          <input type="checkbox" checked={settings.autoRecycle} onChange={(e) => update("autoRecycle", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
        </Row>
        <Row label="Auto-approve pending posts" desc="Posts submitted for review are auto-approved after a delay unless a reviewer acts first (fact-check blocks are never auto-approved). Runs via the auto-approve cron.">
          <input type="checkbox" checked={settings.autoApprove} onChange={(e) => update("autoApprove", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600" />
        </Row>
        {settings.autoApprove && (
          <Row label="Auto-approve delay (hours)" desc="How long a post waits for a human reviewer before it auto-approves">
            <input type="number" min="1" value={settings.autoApproveHours}
              onChange={(e) => update("autoApproveHours", Number(e.target.value) || 24)}
              className="w-20 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm outline-none focus:border-indigo-500" />
          </Row>
        )}
      </Section>

      {/* Developer API keys — admin-only (component hides itself otherwise) */}
      <ApiKeysSection />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
          <Save size={15} /> {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm font-medium text-green-600 dark:text-green-400">Saved ✓</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="border-b border-slate-100 dark:border-gray-800 px-5 py-3"><p className="text-sm font-semibold text-slate-800 dark:text-white">{title}</p></div>
      <div className="divide-y divide-slate-100 dark:divide-gray-800">{children}</div>
    </div>
  );
}
function Row({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{label}</p>
        {desc && <p className="text-xs text-slate-400 dark:text-gray-500">{desc}</p>}
      </div>
      {children}
    </div>
  );
}
