// Column catalog for the Post Analytics table. The post identity — thumbnail,
// caption/title, content type and page — lives in a fixed sticky column (see
// PostAnalyticsView), mirroring Meta Business Suite. The columns below are the
// customisable, horizontally-scrolling metric columns.

export const COLUMN_DEFS = [
  { key: "datePublished", label: "Date published", group: "Content details", kind: "date", align: "left", desc: "When the post was published." },
  // Performance
  { key: "views",   label: "Views",   group: "Performance", kind: "num", align: "right", desc: "Times your content was on screen." },
  { key: "reach",   label: "Reach",   group: "Performance", kind: "num", align: "right", desc: "Accounts that saw your content at least once (Facebook / Instagram)." },
  { key: "viewers", label: "Viewers", group: "Performance", kind: "num", align: "right", desc: "Accounts that viewed your content. Currently mirrors Reach — Meta's API exposes a single unique-audience value." },
  // Engagement
  { key: "interactions",   label: "Interactions",      group: "Engagement", kind: "num", align: "right", desc: "Likes, comments, shares and saves combined." },
  { key: "likes",          label: "Likes & reactions", group: "Engagement", kind: "num", align: "right", desc: "Likes and reactions on the post." },
  { key: "comments",       label: "Comments",          group: "Engagement", kind: "num", align: "right", desc: "Comments on the post." },
  { key: "shares",         label: "Shares",            group: "Engagement", kind: "num", align: "right", desc: "Times the post was shared (not available on YouTube)." },
  { key: "saves",          label: "Saves",             group: "Engagement", kind: "num", align: "right", desc: "Times the post was saved (Instagram only)." },
  { key: "linkClicks",     label: "Link clicks",       group: "Engagement", kind: "num", align: "right", desc: "Clicks on the post (Facebook)." },
  { key: "replies",        label: "Replies",           group: "Engagement", kind: "num", align: "right", desc: "Replies (Threads and X)." },
  { key: "follows",        label: "Follows",           group: "Engagement", kind: "num", align: "right", desc: "Follows attributed to this post — rarely exposed by the platform APIs." },
  { key: "engagementRate", label: "Engagement rate",   group: "Engagement", kind: "pct", align: "right", desc: "Interactions divided by reach." },
  // Video
  { key: "threeSecondViews", label: "3-second views", group: "Video", kind: "num",         align: "right", desc: "3-second video views (Facebook video)." },
  { key: "watchTime",        label: "Watch time",     group: "Video", kind: "duration",    align: "right", desc: "Total time your video was watched." },
  { key: "avgPlayTime",      label: "Avg play time",  group: "Video", kind: "durationAvg", align: "right", desc: "Average time watched per view." },
];

export const COLUMN_BY_KEY = Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, c]));

// Grouped, in catalog order — for the customise modal's show/hide panel.
export const COLUMN_GROUPS = COLUMN_DEFS.reduce((acc, c) => {
  const g = acc.find((x) => x.label === c.group);
  if (g) g.columns.push(c);
  else acc.push({ label: c.group, columns: [c] });
  return acc;
}, []);

// Visible columns (in order) before the user customises — mirrors Meta's default
// (Reach, Views, Viewers, Date published, then core engagement), with the video
// metrics on by default so video posts surface watch data (they read "—" for
// non-video posts, exactly like Meta Business Suite).
export const DEFAULT_VISIBLE = [
  "reach", "views", "viewers", "datePublished",
  "interactions", "likes", "comments", "shares", "linkClicks",
  "watchTime", "avgPlayTime", "threeSecondViews",
];

// Only `datePublished` is a top-level row field; the rest live under row.metrics.
export function cellValue(row, key) {
  if (key === "datePublished") return row.datePublished ?? null;
  return row.metrics?.[key] ?? null;
}

export function compactNum(n) {
  if (n == null) return null;
  const v = Number(n);
  if (!isFinite(v)) return null;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

export function fmtDuration(secs) {
  if (secs == null) return null;
  const s = Math.round(Number(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

// Display string for a cell; "—" for missing (N/A). Used by the table + CSV.
export function formatCell(kind, value) {
  if (value == null || value === "") return "—";
  switch (kind) {
    case "num": return compactNum(value);
    case "pct": return `${value}%`;
    case "duration": return fmtDuration(value);
    case "durationAvg": return `${Number(value).toFixed(1)}s`;
    case "date":
      return new Date(value).toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    default: return String(value);
  }
}

// Comparable value for sorting (numbers as numbers, dates as epoch ms, text lc).
// Nulls sink to the bottom via -Infinity / "".
export function sortValue(kind, value) {
  if (value == null) return kind === "date" ? 0 : -Infinity;
  if (kind === "date") return new Date(value).getTime();
  if (kind === "num" || kind === "pct" || kind === "duration" || kind === "durationAvg") return Number(value);
  return String(value).toLowerCase();
}

// Rich content-type label incl. Reel/Story (from platform_options), like Meta's
// "Photo · Story" sub-line. Falls back to the coarse postType.
export function contentLabel(row) {
  const fmt = row.platformOptions?.[row.platform]?.format;
  if (fmt === "reel") return "Reel";
  if (fmt === "story") return "Story";
  const t = row.postType || "post";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
