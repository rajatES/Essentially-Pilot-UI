import { Facebook, Instagram, Youtube, Twitter, MessageSquare } from "lucide-react";

// Shared platform + status presentation, extracted from app/app/page.js so
// every view (posts, calendar, accounts, compose) renders them identically.

export const STATUS_STYLES = {
  draft:          "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-800",
  pending_review: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30",
  approved:       "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30",
  rejected:       "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30",
  scheduled:      "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30",
  publishing:     "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30",
  sent:           "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30",
  failed:         "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30",
  deleted:        "bg-slate-700 dark:bg-gray-700 text-white border border-slate-700 dark:border-gray-700"
};

// Human label for a status chip ("deleted" alone wouldn't say where).
export function statusLabel(status) {
  return status === "deleted" ? "deleted on platform" : status;
}

// Platform metadata — icon + colour. facebook + instagram post via the same
// Meta login; youtube/twitter need their own OAuth apps (added when configured).
export const PLATFORM_META = {
  facebook:  { label: "Facebook",  Icon: Facebook,  color: "text-blue-600",  bg: "bg-blue-100" },
  instagram: { label: "Instagram", Icon: Instagram, color: "text-pink-600",  bg: "bg-pink-100" },
  threads:   { label: "Threads",   Icon: MessageSquare, color: "text-slate-800 dark:text-gray-200", bg: "bg-slate-200 dark:bg-gray-700" },
  youtube:   { label: "YouTube",   Icon: Youtube,   color: "text-red-600 dark:text-red-400",   bg: "bg-red-100 dark:bg-red-500/20" },
  twitter:   { label: "Twitter/X", Icon: Twitter,   color: "text-sky-600",   bg: "bg-sky-100" }
};

export function PlatformIcon({ platform, size = 16 }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.facebook;
  const { Icon } = meta;
  return <Icon size={size} className={meta.color} />;
}

export function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
  });
}
