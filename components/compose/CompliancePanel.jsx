"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";

// Advisory compliance flag list — same rendering as the old composer.
export default function CompliancePanel({ compliance, hasContent }) {
  const { complianceReport, imageFlags, liveFlags, imageScanning, totalFlags, hasFlags } = compliance;

  return (
    <>
      {imageScanning && (
        <p className="flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-400">
          <RefreshCw size={12} className="animate-spin" /> Scanning image for compliance…
        </p>
      )}
      {hasFlags && hasContent && (
        <div className="space-y-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-300">
            <ShieldAlert size={15} /> {totalFlags} compliance flag{totalFlags !== 1 ? "s" : ""}
          </p>
          <ul className="space-y-1.5">
            {[...complianceReport.high, ...complianceReport.med, ...complianceReport.low].map((f) => (
              <li key={f.id} className="text-xs text-red-700 dark:text-red-300">
                <span className="mr-1.5 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">
                  {complianceReport.high.includes(f) ? "HIGH" : complianceReport.med.includes(f) ? "MED" : "LOW"}
                </span>
                {f.message}
              </li>
            ))}
            {imageFlags.map((f, i) => (
              <li key={`img-${i}`} className="text-xs text-red-700 dark:text-red-300">
                <span className="mr-1.5 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">{f.severity}</span>
                <span className="mr-1 rounded bg-red-100 dark:bg-red-500/20 px-1 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">IMAGE</span>
                <strong>{f.label}:</strong> {f.message}
              </li>
            ))}
            {liveFlags.map((f, i) => (
              <li key={`live-${i}`} className="text-xs text-red-700 dark:text-red-300">
                <span className="mr-1.5 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">{f.severity}</span>
                <strong>{f.label}:</strong> {f.message}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-700 dark:text-red-300">
            These are warnings only — you can still post or schedule. Optionally submit for review if you want a GH to check first.
          </p>
        </div>
      )}
    </>
  );
}
