"use client";

import { useState } from "react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

// Round account/page avatar with a graceful fallback. Facebook page pictures
// are served from expiring scontent CDN URLs, so we prefer FB's STABLE picture
// endpoint (derived from the page id) — which never expires — and fall back to
// the platform icon on any load error (covers IG's expiring URLs and null too).
export default function AccountAvatar({ account, size = 28, className = "" }) {
  const [failed, setFailed] = useState(false);
  const meta = PLATFORM_META[account?.platform];
  const src =
    account?.platform === "facebook" && account?.external_account_id
      ? `https://graph.facebook.com/${account.external_account_id}/picture?type=square`
      : account?.avatar_url || null;
  const dim = { width: size, height: size };

  if (src && !failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={dim}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={dim}
      className={`flex items-center justify-center rounded-full ${meta?.bg || "bg-indigo-100 dark:bg-indigo-500/20"} ${className}`}
    >
      <PlatformIcon platform={account?.platform} size={Math.round(size * 0.48)} />
    </div>
  );
}
