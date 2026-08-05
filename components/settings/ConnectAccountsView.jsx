"use client";

import { Facebook, Instagram, Youtube, MessageCircle, Twitter } from "lucide-react";
import { apiUrl } from "@/lib/apiClient";

// onConnectMeta(switchAccount) — opens the Facebook JS-SDK popup flow (page
// selection + per-account tracking) for the combined Facebook+Instagram
// picker. YouTube keeps its own OAuth redirect. onConnectInstagram() opens
// the same popup but the picker it returns is filtered down to linked
// Instagram accounts only (see AppShell.fetchFacebookPages mode="instagram")
// — an Instagram account has its own access token, so connecting one never
// requires also connecting its linked Facebook Page.
//
// canManageAccounts gates the full platform list. Non-admins (members) get an
// Instagram + YouTube view — connecting an Instagram account or a YouTube
// channel is open to everyone, but Facebook Pages/X/Threads connect and page
// management stay admin/Group-Head only.
export default function ConnectAccountsView({ onConnectMeta, onConnectInstagram, canManageAccounts = true }) {
  const platforms = [
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      color: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
      onClick: () => onConnectMeta?.(false),
      buttonText: "Connect Pages",
      description: "Connect your Facebook Pages to schedule posts"
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30",
      // Admins use the combined Facebook+Instagram popup they already have;
      // everyone else gets the Instagram-only flow (no Facebook Page connect).
      onClick: canManageAccounts ? () => onConnectMeta?.(false) : () => onConnectInstagram?.(),
      buttonText: "Connect Business/Creator",
      description: "Connect through Facebook Pages (Business/Creator accounts linked to Pages)"
    },
    {
      id: "youtube",
      name: "YouTube",
      icon: Youtube,
      color: "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
      connectUrl: apiUrl("/api/auth/youtube/start"),
      buttonText: "Connect Channel",
      description: "Connect your YouTube channel to schedule videos"
    },
    {
      id: "x",
      name: "X (Twitter)",
      icon: Twitter,
      color: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30",
      connectUrl: apiUrl("/api/auth/x/start"),
      buttonText: "Connect Account",
      description: "Sign in with the X account you post from — publishes via the queue at the scheduled time"
    },
    {
      id: "threads",
      name: "Threads",
      icon: MessageCircle,
      color: "bg-slate-50 text-slate-800 border-slate-200 dark:bg-gray-800/50 dark:text-white dark:border-gray-700",
      connectUrl: apiUrl("/api/auth/threads/start"),
      buttonText: "Connect Profile",
      description: "Sign in with the Threads profile you post from — Threads uses its own login, separate from Facebook"
    }
  ];

  // Members without account-management rights can still connect Instagram
  // and YouTube.
  const visiblePlatforms = canManageAccounts
    ? platforms
    : platforms.filter((p) => p.id === "instagram" || p.id === "youtube");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Connect Accounts</h2>
        <p className="mt-1 text-slate-600 dark:text-gray-300">
          {canManageAccounts
            ? "Connect your social media accounts to schedule and manage posts"
            : "Connect an Instagram or YouTube account to schedule posts"}
        </p>
      </div>

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {visiblePlatforms.map((platform) => {
          const IconComponent = platform.icon;
          return (
            <div key={platform.id} className="flex flex-col rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm transition-all hover:shadow-md">
              {/* Icon */}
              <div className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg border ${platform.color}`}>
                <IconComponent size={32} />
              </div>

              {/* Title */}
              <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">{platform.name}</h3>
              <p className="mb-4 text-sm text-slate-600 dark:text-gray-300">{platform.description}</p>

              {/* Button */}
              {platform.onClick ? (
                <button
                  onClick={platform.onClick}
                  className="mt-auto inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
                >
                  {platform.buttonText}
                </button>
              ) : (
                <a
                  href={platform.connectUrl}
                  className="mt-auto inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
                >
                  {platform.buttonText}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Multi-account support */}
      {onConnectMeta && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Pages spread across several Facebook accounts?</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
              Connect each account one at a time — its pages are added alongside the ones already connected.
            </p>
          </div>
          <button
            onClick={() => onConnectMeta(true)}
            className="inline-flex items-center justify-center rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
          >
            Connect a different account
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-4 text-sm text-indigo-800 dark:text-indigo-300">
        <p className="font-medium">💡 How it works:</p>
        <ul className="mt-2 space-y-1 text-indigo-700 dark:text-indigo-400">
          {canManageAccounts ? (
            <>
              <li>• <strong>Facebook & Instagram:</strong> Connect through the same popup. Pick the Pages you want; linked Instagram Business accounts come along automatically.</li>
              <li>• <strong>Multiple accounts:</strong> Pages from different Facebook accounts can be connected side by side — use “Connect a different account” to sign in as another user.</li>
              <li>• <strong>Development mode:</strong> every Facebook account used to connect must be added as a Tester under App Roles in the Meta developer dashboard.</li>
              <li>• <strong>YouTube:</strong> Connect your Google account to schedule videos to your channels.</li>
              <li>• <strong>Threads:</strong> Uses its own Threads login (not Facebook) — each Threads profile connects individually and posts publish via the queue at the scheduled time.</li>
            </>
          ) : (
            <>
              <li>• <strong>Instagram:</strong> Connect an Instagram Business/Creator account linked to a Facebook Page — you'll sign in with Facebook, but only the Instagram account is connected (no Facebook Page is added). It becomes available to everyone in the workspace.</li>
              <li>• <strong>YouTube:</strong> Connect your Google account to schedule videos to your channels. The channel becomes available to everyone in the workspace.</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
