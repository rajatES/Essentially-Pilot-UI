"use client";

import { useEffect, useState } from "react";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";

// Best picture URL for a connected account/page. Facebook page pictures from
// the Graph API are served from EXPIRING scontent CDN URLs (they 403 after a
// while), so derive FB's STABLE, non-expiring picture endpoint from the page id
// instead — this fixes accounts connected before we started storing the stable
// URL, without needing a reconnect. Everything else uses the stored avatar_url.
export function accountAvatarUrl(account) {
  if (account?.platform === "facebook" && account?.external_account_id) {
    return `https://graph.facebook.com/${account.external_account_id}/picture?type=square`;
  }
  return account?.avatar_url || null;
}

// Round account/page avatar with a graceful fallback. On any image load error
// (expired/blocked URL) it renders `fallback` when provided, otherwise the
// platform icon on a tinted circle.
export default function AccountAvatar({ account, size = 28, className = "", fallback = null }) {
  const src = accountAvatarUrl(account);
  const [failed, setFailed] = useState(false);
  // Reset the error state when the source changes (e.g. switching accounts),
  // so a previous failure doesn't hide a good image.
  useEffect(() => { setFailed(false); }, [src]);

  const meta = PLATFORM_META[account?.platform];
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
  if (fallback) return fallback;
  return (
    <div
      style={dim}
      className={`flex items-center justify-center rounded-full ${meta?.bg || "bg-indigo-100 dark:bg-indigo-500/20"} ${className}`}
    >
      <PlatformIcon platform={account?.platform} size={Math.round(size * 0.48)} />
    </div>
  );
}
