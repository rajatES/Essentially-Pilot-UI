"use client";

import { useMemo, useState } from "react";

// Single source of truth for the 3-panel composer. `prefill` comes from the
// shell (template "Use", post Duplicate, calendar click-day) and is consumed
// once via a keyed remount of ComposeView.
export default function useComposerState({ prefill, appSettings, accounts }) {
  const [state, setState] = useState(() => {
    const src = prefill?.post;
    return {
      mode: prefill?.scheduledFor ? "schedule" : "schedule", // schedule | queue | next | now
      selectedIds: src ? (src.post_targets || []).map((t) => t.social_account_id).filter(Boolean) : [],
      body: src?.body || prefill?.templateText || "",
      customize: false,
      platformCaptions: src?.platform_captions || {},
      media: Array.isArray(src?.media)
        ? src.media.map((m) => ({ url: m.url, type: m.type === "video" ? "video" : "image" }))
        : src?.image_url ? [{ url: src.image_url, type: "image" }] : [],
      linkUrl: src?.link_url || "",
      firstComment: src?.first_comment || appSettings?.defaultFirstComment || "",
      contentType: src?.content_type || "",
      templateId: prefill?.templateId || "",
      scheduledFor: prefill?.scheduledFor || "",
      platformOptions: src?.platform_options || {},
    };
  });

  const update = (patch) => setState((s) => ({ ...s, ...patch }));

  // Platforms represented in the current selection, in a stable order.
  const selectedPlatforms = useMemo(() => {
    const order = ["facebook", "instagram", "threads", "twitter", "youtube"];
    const set = new Set(
      (accounts || []).filter((a) => state.selectedIds.includes(a.id)).map((a) => a.platform),
    );
    return order.filter((p) => set.has(p));
  }, [accounts, state.selectedIds]);

  // Effective caption for a platform: per-platform override (when customizing)
  // falls back to the master caption.
  const effectiveCaption = (platform) =>
    (state.customize && state.platformCaptions?.[platform]?.trim()) || state.body;

  // First selected account of a platform — the identity previews render with.
  const accountFor = (platform) =>
    (accounts || []).find((a) => state.selectedIds.includes(a.id) && a.platform === platform) || null;

  return { state, update, selectedPlatforms, effectiveCaption, accountFor };
}
