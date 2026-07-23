"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

// Contextual per-platform error list (SocialPilot-style): hard errors keep
// the publish CTAs disabled; warnings are informational.
export default function ValidationPanel({ errorsByPlatform }) {
  const platforms = Object.keys(errorsByPlatform);
  if (!platforms.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
      {platforms.map((p) => (
        <div key={p}>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-gray-300">
            <PlatformIcon platform={p} size={13} /> {PLATFORM_META[p]?.label || p}
          </p>
          <ul className="space-y-1">
            {errorsByPlatform[p].map((e, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-xs ${e.level === "error" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                {e.level === "error" ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                {e.msg}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
