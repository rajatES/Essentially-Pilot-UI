"use client";

import { useEffect, useMemo, useState } from "react";
import { runCompliance } from "@/lib/compliance";
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/components/common/ToastProvider";

// The ES compliance system, moved verbatim from the old composer:
//  1. synchronous regex rules (lib/compliance.js) on caption/link/etc,
//  2. image OCR scan via /api/compliance/image (3s cap, images only),
//  3. debounced DB-backed live checks (cadence collisions, duplicate captions).
// Advisory only — flags never block posting (same semantics as before).
export default function useCompliance({ state, accounts }) {
  const showToast = useToast();

  const complianceReport = useMemo(() => {
    const chosenAccounts = (accounts || []).filter((a) => state.selectedIds.includes(a.id));
    return runCompliance({
      body: state.body,
      linkUrl: state.linkUrl,
      imageUrl: state.media.length ? "pending" : null,
      contentType: state.contentType,
      accounts: chosenAccounts,
      mode: state.mode === "now" ? "now" : "schedule",
    });
  }, [state.body, state.linkUrl, state.media.length, state.contentType, state.selectedIds, state.mode, accounts]);

  // Image OCR scan — first attached image (regex rules can't see inside it).
  const [imageFlags, setImageFlags] = useState([]);
  const [imageScanning, setImageScanning] = useState(false);
  const firstImageUrl = state.media.find((m) => m.type === "image")?.url || null;

  useEffect(() => {
    let cancelled = false;
    async function scan() {
      if (!firstImageUrl) { setImageFlags([]); return; }
      setImageScanning(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        let r, d;
        try {
          r = await apiFetch("/api/compliance/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: firstImageUrl }),
            signal: controller.signal
          });
          d = await r.json();
        } finally {
          clearTimeout(timeoutId);
        }
        if (cancelled) return;
        if (!r.ok) throw new Error(d.error || "Image scan failed.");
        setImageFlags(d.flags || []);
        if ((d.flags || []).some((f) => f.severity === "HIGH")) {
          showToast("The attached image was flagged by compliance review — consider submitting for review.", "error");
        }
      } catch (err) {
        if (cancelled) return;
        // Timeout → let the post through silently (3s cap by design).
        if (err.name === "AbortError") { setImageFlags([]); return; }
        // Any other failure → soft MED flag for manual review.
        setImageFlags([{ severity: "MED", label: "Image scan failed", message: `${err.message} Review the image manually or submit for review.` }]);
      } finally {
        if (!cancelled) setImageScanning(false);
      }
    }
    scan();
    return () => { cancelled = true; };
  }, [firstImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced DB-backed checks (cadence collisions + duplicate captions).
  const [liveFlags, setLiveFlags] = useState([]);
  useEffect(() => {
    if (!state.body.trim() || !state.selectedIds.length) { setLiveFlags([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch("/api/compliance/live-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: state.body,
            accountIds: state.selectedIds,
            scheduledFor: state.mode === "now" ? null : state.scheduledFor
          })
        });
        const d = await r.json();
        if (!cancelled) setLiveFlags(d.flags || []);
      } catch {
        if (!cancelled) setLiveFlags([]);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [state.body, state.selectedIds, state.scheduledFor, state.mode]);

  const totalFlags = complianceReport.autoFlags + imageFlags.length + liveFlags.length;

  return { complianceReport, imageFlags, liveFlags, imageScanning, totalFlags, hasFlags: totalFlags > 0 };
}
