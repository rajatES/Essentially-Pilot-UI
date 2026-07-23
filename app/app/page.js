"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Send, Calendar, Users, Plus, Facebook, RefreshCw,
  Trash2, CheckCircle2, XCircle, Clock, ImagePlus, Zap,
  ChevronLeft, ChevronRight, X, LayoutList, AlertCircle,
  Link as LinkIcon, ExternalLink, Search, Filter, ShieldCheck,
  ShieldAlert, Instagram, Youtube, Twitter, Pencil, Sparkles, FileText, Bell,
  MessageSquare, Image as ImageIcon, FolderOpen, LogOut, Tag
} from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { runCompliance } from "@/lib/compliance";
import { externalPostUrl } from "@/lib/fbLink";
import { apiFetch, apiJson, apiUrl } from "@/lib/apiClient";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import DashboardView from "@/components/dashboard/DashboardView";
import SettingsView, { applyDarkMode } from "@/components/settings/SettingsView";
import ConnectAccountsView from "@/components/settings/ConnectAccountsView";
import QueueEditorView from "@/components/settings/QueueEditorView";
import GlobalSearch from "@/components/common/GlobalSearch";
import NotificationsBell from "@/components/common/NotificationsBell";
import MediaLibraryView from "@/components/media/MediaLibraryView";
import TemplatesView from "@/components/templates/TemplatesView";
import TeamView from "@/components/team/TeamView";
import { getToken, clearToken } from "@/lib/apiClient";
import { pickImageFromGoogleDrive } from "@/lib/googleDrivePicker";
import { useRouter } from "next/navigation";

const STATUS_STYLES = {
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
function statusLabel(status) {
  return status === "deleted" ? "deleted on Facebook" : status;
}

// Platform metadata — icon + colour. facebook + instagram post via the same
// Meta login; youtube/twitter need their own OAuth apps (added when configured).
const PLATFORM_META = {
  facebook:  { label: "Facebook",  Icon: Facebook,  color: "text-blue-600",  bg: "bg-blue-100" },
  instagram: { label: "Instagram", Icon: Instagram, color: "text-pink-600",  bg: "bg-pink-100" },
  threads:   { label: "Threads",   Icon: MessageSquare, color: "text-slate-800 dark:text-gray-200", bg: "bg-slate-200 dark:bg-gray-700" },
  youtube:   { label: "YouTube",   Icon: Youtube,   color: "text-red-600 dark:text-red-400",   bg: "bg-red-100 dark:bg-red-500/20" },
  twitter:   { label: "Twitter/X", Icon: Twitter,   color: "text-sky-600",   bg: "bg-sky-100" }
};

function PlatformIcon({ platform, size = 16 }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.facebook;
  const { Icon } = meta;
  return <Icon size={size} className={meta.color} />;
}

const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { id: "compose",   label: "Create Post", icon: Plus },
  { id: "queue",     label: "Posts",       icon: LayoutList },
  { id: "calendar",  label: "Calendar",    icon: Calendar },
  { id: "queues",    label: "Posting Queue", icon: Clock },
  { id: "media",     label: "Media",       icon: ImageIcon },
  { id: "templates", label: "Templates",   icon: FileText },
  { id: "accounts",  label: "Accounts",    icon: Users },
  { id: "team",      label: "Team",        icon: Users },
  { id: "settings",  label: "Settings",    icon: SettingsIcon }
];

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
  });
}

function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

// Minimal CSV parser — handles quoted fields, escaped quotes, and CRLF.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const CSV_TEMPLATE = `text,scheduled_for,pages,image_url,link_url,first_comment,content_type
"Big fight tonight — who are you backing?",2026-07-10 19:00,Boxing News and Memes,https://example.com/img.jpg,,,meme_image
"Race day! 🏁",2026-07-11 13:00,"Forever the Intimidator Fan Club",,,"Full story in the comments",lic
"Posts to every connected page",2026-07-12 09:00,all,,,,`;
// content_type is optional for bulk import (infographic / meme_image / lic, or leave blank) —
// unlike single-post scheduling, bulk rows aren't required to have one.

// ─── main component ──────────────────────────────────────────────────────────

export default function AppPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [accounts, setAccounts]   = useState([]);
  const [posts, setPosts]         = useState([]);
  const [view, setView]           = useState("dashboard");
  const [accountsTab, setAccountsTab] = useState("manage"); // "connect" | "manage" — sub-tabs within the Accounts view
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(true);

  // facebook connect (JS SDK popup) state
  const [fbReady, setFbReady]         = useState(false);
  const [fetchedPages, setFetchedPages] = useState(null); // null = modal closed
  const [fetchedGrantor, setFetchedGrantor] = useState(null); // FB account that granted the pages being confirmed
  const [pagePicks, setPagePicks]     = useState([]);
  const [modalSearch, setModalSearch] = useState("");   // search inside connect modal
  const [composeSearch, setComposeSearch] = useState(""); // search in compose "Publish to"
  const [pagesCollapsed, setPagesCollapsed] = useState(false);

  // compose state
  const [body, setBody]               = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [linkUrl, setLinkUrl]         = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [imageFile, setImageFile]     = useState(null);  // uploaded file
  const [imageUrl, setImageUrl]       = useState("");    // pasted/picked image URL
  const [urlDraft, setUrlDraft]       = useState("");    // URL input field text
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaItems, setMediaItems]   = useState([]);    // extra media beyond the primary: [{url, type, name}]
  const [addingMedia, setAddingMedia] = useState(false); // "add more" upload in flight
  const [postMode, setPostMode]       = useState("schedule"); // "schedule" | "queue" | "now"
  const [saving, setSaving]           = useState(false);
  const [contentType, setContentType] = useState(""); // "" | "infographic" | "meme_image" | "lic" — for team post-count tracking
  const [aiTone, setAiTone]           = useState("professional");
  const [aiBusy, setAiBusy]           = useState(false);
  const [templates, setTemplates]     = useState([]);
  const [templateId, setTemplateId]   = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [appSettings, setAppSettings] = useState({});

  // Canva design picker state
  const [showCanva, setShowCanva]         = useState(false);
  const [canvaDesigns, setCanvaDesigns]   = useState([]);
  const [canvaBusy, setCanvaBusy]         = useState(false);

  // posts queue bulk-select state
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [bulkBusy, setBulkBusy]           = useState(false);

  // CSV import state
  const [showImport, setShowImport]     = useState(false);
  const [importBusy, setImportBusy]     = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [authors, setAuthors]             = useState([]); // team roster, for attribution
  const [authorFilter, setAuthorFilter]   = useState("all");

  // calendar state
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView]   = useState("month"); // month | week | day | list
  const [calAnchor, setCalAnchor] = useState(now.toISOString()); // ref date for week/day
  const [detailPost, setDetailPost] = useState(null); // post shown in the detail drawer
  const [editing, setEditing]       = useState(false);
  const [editDraft, setEditDraft]   = useState({ body: "", linkUrl: "", scheduledFor: "" });

  // accounts hub state
  const [acctSearch, setAcctSearch]   = useState("");
  const [acctSport, setAcctSport]     = useState("all"); // sport filter
  const [acctPlatform, setAcctPlatform] = useState("all"); // platform filter
  const [selectedAccts, setSelectedAccts] = useState([]); // bulk selection
  const [syncing, setSyncing]         = useState(false);


  // ── toast ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── auth gate ──────────────────────────────────────────────────────────────
  // With JWT-in-localStorage there's no cookie for edge middleware to read, so
  // the /app route is gated client-side: no token → straight to /login.
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  // ── data ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!getToken()) return; // not logged in — the auth-gate effect redirects
    loadData();
    // Returning from the Canva OAuth redirect?
    const params = new URLSearchParams(window.location.search);
    if (params.get("canva") === "connected") {
      showToast("Canva connected — click the Canva button to pick a design.", "ok");
      setView("compose");
      window.history.replaceState({}, "", "/app");
    } else if (params.get("canva") === "error") {
      showToast("Canva connection failed — try again.", "error");
      window.history.replaceState({}, "", "/app");
    } else if (params.get("youtube") === "connected") {
      // Returning from the YouTube OAuth redirect (success).
      showToast(`Connected ${params.get("channels") || ""} YouTube channel(s).`, "ok");
      setView("accounts");
      window.history.replaceState({}, "", "/app");
      loadData();
    } else if (params.get("error")) {
      // Returning from the Facebook or YouTube OAuth redirect (failure) —
      // both routes redirect back here with ?error=... on any rejection.
      showToast(params.get("error"), "error");
      window.history.replaceState({}, "", "/app");
    } else if (params.get("success")) {
      // Returning from the Facebook OAuth redirect (success).
      showToast(params.get("success"), "ok");
      setView("accounts");
      window.history.replaceState({}, "", "/app");
      loadData();
    }
    // Re-check recent posts against Facebook (deleted after publishing?
    // native-scheduled post gone live?) and refresh if anything changed.
    apiFetch("/api/posts/verify", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.deleted > 0 || d.published > 0) {
          loadData();
          if (d.deleted > 0) showToast(`${d.deleted} post(s) were deleted on Facebook — statuses updated.`, "warn");
          if (d.published > 0) showToast(`${d.published} scheduled post(s) went live on Facebook.`, "ok");
        }
      })
      .catch(() => {});
    // Apply saved dark-mode preference immediately (localStorage), then confirm from server.
    try {
      const cached = JSON.parse(localStorage.getItem("app-settings") || "{}");
      if (cached.darkMode) applyDarkMode(true);
    } catch { /* ignore */ }
    apiFetch("/api/settings").then((r) => r.json()).then((d) => {
      setAppSettings(d.settings || {});
      if (d.settings?.darkMode) applyDarkMode(true);
    }).catch(() => {});
    apiFetch("/api/templates?kind=caption").then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => {});
    apiFetch("/api/me").then((r) => r.json()).then((d) => setMe(d.profile || null)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  // Prefill the first-comment field from Settings defaults when opening a fresh compose.
  useEffect(() => {
    if (view === "compose" && !firstComment && appSettings.defaultFirstComment) {
      setFirstComment(appSettings.defaultFirstComment);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the Facebook JS SDK once (client-side login popup flow)
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) return;

    if (window.FB) { setFbReady(true); return; }

    window.fbAsyncInit = function () {
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v23.0" });
      setFbReady(true);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
  }, []);

  // JSON call to the backend API — resolves the backend origin and attaches
  // the Supabase session token (see lib/apiClient.js).
  async function api(path, options = {}) {
    return apiJson(path, options);
  }

  async function loadData() {
    setLoading(true);
    try {
      const data = await api("/api/posts");
      setAccounts(data.accounts);
      setPosts(data.posts);
      setAuthors(data.authors || []);
      if (data.accounts.length) {
        setSelectedIds((prev) => prev.length ? prev : [data.accounts[0].id]);
      }
    } catch (err) {
      // apiFetch clears the token on a 401 — bounce to login rather than
      // showing a broken shell.
      if (!getToken()) { router.replace("/login"); return; }
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── connect facebook (JS SDK popup → fetch-pages → confirm-pages) ────────────

  // switchAccount=true forces Facebook to ask for credentials again so the
  // user can sign in with a DIFFERENT account — this is how pages from
  // multiple FB accounts get connected (each page keeps its own token, so
  // pages from several accounts coexist happily).
  // NOTE: while the Meta app is in development mode, every FB account used
  // here must have a role on the app (Meta dashboard → App Roles → Testers).
  function connectFacebook(switchAccount = false) {
    if (!fbReady || !window.FB) {
      showToast("Facebook SDK is still loading — try again in a second.", "warn");
      return;
    }

    const callback = (response) => {
      if (response.status !== "connected" || !response.authResponse?.accessToken) {
        showToast("Facebook login was cancelled or denied.", "error");
        return;
      }
      fetchFacebookPages(response.authResponse.accessToken);
    };

    // Two login modes depending on how the Meta app is set up:
    //  - "Facebook Login for Business" apps CANNOT request page-management /
    //    IG-publish permissions via `scope` (they come back as "Invalid
    //    Scopes"). They require a pre-built Configuration; pass its config_id.
    //    Set NEXT_PUBLIC_FACEBOOK_CONFIG_ID to that configuration's ID.
    //  - Classic "Facebook Login" apps use the `scope` list directly.
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;
    if (configId) {
      window.FB.login(callback, {
        config_id: configId,
        // The configuration defines the assets/permissions; for re-selecting
        // Pages or switching accounts we still force the auth screens.
        auth_type: switchAccount ? "reauthenticate" : "rerequest",
      });
      return;
    }

    window.FB.login(callback, {
      // Classic Facebook Login: request permissions directly. Must match the
      // permissions the app is approved for. instagram_* back IG publishing/
      // comments/insights; read_insights backs the FB post-metrics sync.
      scope: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_engagement",
        "read_insights",
        "business_management",
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
      ].join(","),
      return_scopes: true,
      // "rerequest" forces the permission + page-selection screen every time
      // so the "opt in to your Pages" step can't be skipped (fixes 0-pages).
      // "reauthenticate" additionally forces the credential screen, letting
      // the user switch to another Facebook account.
      auth_type: switchAccount ? "reauthenticate" : "rerequest",
    });
  }

  async function fetchFacebookPages(shortLivedToken) {
    setSaving(true);
    try {
      const data = await api("/api/social/facebook/fetch-pages", {
        method: "POST",
        body: JSON.stringify({ shortLivedToken })
      });

      if (!data.pages?.length) {
        showToast(data.error || "No Pages found on your account.", "error");
        return;
      }

      // Open the selection modal with everything pre-checked. Pages already
      // connected stay checked-and-locked visually via the accounts list.
      setFetchedPages(data.pages);
      setFetchedGrantor(data.grantor || null);
      setPagePicks(data.pages.map((p) => p.id));
      setModalSearch("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmFacebookPages() {
    const chosen = fetchedPages.filter((p) => pagePicks.includes(p.id));
    if (!chosen.length) { showToast("Select at least one Page.", "error"); return; }

    setSaving(true);
    try {
      const data = await api("/api/social/facebook/confirm-pages", {
        method: "POST",
        body: JSON.stringify({ pages: chosen, grantor: fetchedGrantor })
      });
      setAccounts(data.accounts || []);
      setFetchedPages(null);
      setFetchedGrantor(null);
      setPagePicks([]);
      setModalSearch("");
      showToast(`Connected ${data.connected} page${data.connected === 1 ? "" : "s"}.`, "ok");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── compose & schedule ─────────────────────────────────────────────────────

  // Live compliance check — recomputes as the caption/link/pages/media change.
  // Rendered inline in the composer (no modal); any automated flag blocks the
  // direct Schedule/Post Now path and routes the post through manual review.
  const complianceReport = useMemo(() => {
    const chosenAccounts = accounts.filter((a) => selectedIds.includes(a.id));
    return runCompliance({ body, linkUrl, imageUrl: (imageFile || imageUrl) ? "pending" : null, contentType, accounts: chosenAccounts, mode: postMode });
  }, [body, linkUrl, imageFile, imageUrl, contentType, selectedIds, accounts, postMode]);

  // Image-text compliance scan — the regex rules above can't see INSIDE the
  // image, so attached media is sent to /api/compliance/image (free local
  // OCR via Tesseract.js, then the same text rules run against what it reads).
  const [imageFlags, setImageFlags] = useState([]);
  const [imageScanning, setImageScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function scan() {
      if (!imageFile && !imageUrl) { setImageFlags([]); return; }
      // OCR compliance scan only applies to images — skip videos.
      if (imageFile?.type?.startsWith("video") || (!imageFile && /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(imageUrl))) {
        setImageFlags([]);
        return;
      }
      setImageScanning(true);
      try {
        let payload;
        if (imageFile) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Couldn't read the image file."));
            reader.readAsDataURL(imageFile);
          });
          payload = { imageBase64: String(dataUrl).split(",")[1], mimeType: imageFile.type || "image/jpeg" };
        } else {
          payload = { imageUrl };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        let r, d;
        try {
          r = await apiFetch("/api/compliance/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
          showToast("The attached image was flagged by compliance review — it can't be published directly.", "error");
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
  }, [imageFile, imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live, data-backed checks (posting-cadence collisions + duplicate captions)
  // that the synchronous regex rules in lib/compliance.js can't do, since they
  // need to look at other rows already in the database. Debounced since it
  // fires on every keystroke/selection change.
  const [liveFlags, setLiveFlags] = useState([]);
  useEffect(() => {
    if (!body.trim() || !selectedIds.length) { setLiveFlags([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch("/api/compliance/live-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, accountIds: selectedIds, scheduledFor: postMode === "now" ? null : scheduledFor })
        });
        const d = await r.json();
        if (!cancelled) setLiveFlags(d.flags || []);
      } catch {
        if (!cancelled) setLiveFlags([]);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [body, selectedIds, scheduledFor, postMode]);

  const totalComplianceFlags = complianceReport.autoFlags + imageFlags.length + liveFlags.length;
  const hasComplianceFlags = totalComplianceFlags > 0;

  // Connecting/disconnecting/recategorizing Pages is restricted to admins and
  // Group Heads — everyone else gets a read-only view of Manage Accounts
  // (they can still pick from already-connected Pages when composing).
  const canManageAccounts = me?.role === "admin" || !!me?.is_group_head;
  const canPost = me?.role === "admin" || !!me?.is_group_head;

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedIds.length) { showToast("Select at least one Page.", "error"); return; }

    if (hasComplianceFlags) {
      showToast("This post has compliance flags — posting anyway.", "warning");
    }

    if (postMode === "schedule") {
      const diff = new Date(scheduledFor).getTime() - Date.now();
      if (diff > 30 * 24 * 60 * 60 * 1000) {
        showToast("Facebook can only schedule up to 30 days ahead.", "error");
        return;
      }
      // Anything sooner than 10 min just posts immediately (handled server-side).
    }

    doPublish();
  }

  // Video vs image, judged from a filename/URL extension.
  function guessMediaType(nameOrUrl) {
    return /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(nameOrUrl || "") ? "video" : "image";
  }

  // Resolve everything attached in the composer into the ordered media array
  // [{url, type}] the API expects: the primary attachment (pending file upload
  // or picked URL) first, then any "add more" items (already uploaded).
  async function resolveComposeMedia() {
    const items = [];
    if (imageFile) {
      const fd = new FormData();
      fd.append("file", imageFile);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const up = await res.json();
      if (!res.ok) throw new Error(up.error || "Media upload failed.");
      items.push({ url: up.url, type: imageFile.type?.startsWith("video") ? "video" : "image" });
    } else if (imageUrl) {
      items.push({ url: imageUrl, type: guessMediaType(imageUrl) });
    }
    for (const m of mediaItems) items.push({ url: m.url, type: m.type });
    return items;
  }

  // "Add more" media: uploads immediately (unlike the primary, which uploads
  // on submit) so the chips can preview real URLs.
  async function addExtraMedia(files) {
    if (!files?.length) return;
    setAddingMedia(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await apiFetch("/api/upload", { method: "POST", body: fd });
        const up = await res.json();
        if (!res.ok) throw new Error(up.error || "Media upload failed.");
        setMediaItems((prev) => [...prev, { url: up.url, type: f.type?.startsWith("video") ? "video" : "image", name: f.name }]);
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setAddingMedia(false);
    }
  }

  // Free/local AI assistant actions.
  async function callAi(action) {
    if (!body.trim() && action !== "cta" && action !== "emojis") {
      showToast("Write a caption first.", "warn");
      return;
    }
    setAiBusy(true);
    try {
      const chosen = accounts.filter((a) => selectedIds.includes(a.id));
      const sport = chosen[0]?.category || "Other";
      const r = await api("/api/ai", { method: "POST", body: JSON.stringify({ action, text: body, sport, tone: aiTone }) });
      if (action === "grammar" || action === "tone" || action === "variations") {
        setBody(action === "variations" ? r.results[0] : r.result);
      } else if (action === "cta") {
        setBody((b) => (b ? b + "\n\n" : "") + r.results[0]);
      } else {
        setBody((b) => (b ? b + "\n\n" : "") + r.result); // hashtags / emojis
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setAiBusy(false);
    }
  }

  // Resolve the first-comment text to send, auto-appending the post's link
  // when Settings → "Default link in first comment" is enabled.
  function effectiveFirstComment() {
    let fc = firstComment.trim();
    if (appSettings.defaultLinkInFirstComment && linkUrl && !fc.includes(linkUrl)) {
      fc = fc ? `${fc}\n${linkUrl}` : linkUrl;
    }
    return fc || null;
  }

  // Approve / reject a post that's pending review.
  async function reviewPost(id, action) {
    try {
      const r = await api("/api/approvals", { method: "POST", body: JSON.stringify({ postId: id, action, reviewer: me?.display_name || "You" }) });
      setDetailPost(r.post);
      if (action === "approve") {
        const ok = r.post.status === "sent" || r.post.status === "scheduled";
        showToast(r.warning ? `Approved — ${r.warning}` : ok ? `Approved and ${r.post.status === "sent" ? "published" : "scheduled"}.` : "Approved, but it failed on every page — check Posts for details.", ok && !r.warning ? "ok" : "warn");
      } else {
        showToast("Post rejected.", "warn");
      }
      await loadData();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  // Save as draft or submit for review (no publishing).
  async function saveDraftOrReview(kind) {
    if (!selectedIds.length) { showToast("Select at least one Page.", "error"); return; }
    if (!body.trim()) { showToast("Write a caption first.", "error"); return; }
    setSaving(true);
    try {
      const media = await resolveComposeMedia();
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          body, media, linkUrl: linkUrl || null, socialAccountIds: selectedIds,
          contentType: contentType || null, templateId: templateId || null, firstComment: effectiveFirstComment(), saveAs: kind
        })
      });
      showToast(kind === "review" ? "Submitted for review." : "Draft saved.");
      setBody(""); setImageFile(null); setImageUrl(""); setUrlDraft(""); setShowUrlInput(false); setMediaItems([]);
      setScheduledFor(""); setLinkUrl(""); setContentType(""); setTemplateId(""); setFirstComment("");
      await loadData();
      setView("queue");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function doPublish() {
    setSaving(true);

    try {
      // Resolve everything attached (primary + extras) into the media array.
      const media = await resolveComposeMedia();
      const fc = effectiveFirstComment();

      if (postMode === "now") {
        const result = await api("/api/publish-now", {
          method: "POST",
          body: JSON.stringify({ body, media, linkUrl: linkUrl || null, socialAccountIds: selectedIds, firstComment: fc, contentType: contentType || null, templateId: templateId || null })
        });
        const allOk = result.results.every((r) => r.status === "sent");
        showToast(allOk ? "Posted!" : "Some pages failed — check Posts for details.", allOk ? "ok" : "warn");
      } else if (postMode === "queue") {
        // "Add to queue" — the backend picks the next open posting slot.
        const result = await api("/api/posts", {
          method: "POST",
          body: JSON.stringify({ body, media, linkUrl: linkUrl || null, socialAccountIds: selectedIds, contentType: contentType || null, templateId: templateId || null, firstComment: fc, saveAs: "queue" })
        });
        const when = result.post?.scheduled_for ? new Date(result.post.scheduled_for).toLocaleString() : "the next open slot";
        showToast(result.warning ? `Queued for ${when} (${result.warning})` : `Queued for ${when}.`, result.warning ? "warn" : "ok");
      } else {
        const result = await api("/api/posts", {
          method: "POST",
          body: JSON.stringify({ body, media, linkUrl: linkUrl || null, scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null, socialAccountIds: selectedIds, contentType: contentType || null, templateId: templateId || null, firstComment: fc })
        });
        const base = result.publishedNow ? "Posted now!" : "Scheduled!";
        const msg = result.warning ? `${base} (${result.warning})` : base;
        showToast(msg, result.warning ? "warn" : "ok");
      }

      setBody("");
      setImageFile(null);
      setImageUrl("");
      setUrlDraft("");
      setShowUrlInput(false);
      setMediaItems([]);
      setScheduledFor("");
      setLinkUrl("");
      setContentType("");
      setTemplateId("");
      setFirstComment("");
      await loadData();
      setView("queue");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── delete post ────────────────────────────────────────────────────────────

  async function deletePost(id) {
    if (!confirm("Delete this post?")) return;
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast("Post deleted.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function togglePostSelect(id) {
    setSelectedPosts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function bulkDeletePosts() {
    if (!selectedPosts.length) return;
    if (!confirm(`Delete ${selectedPosts.length} post(s)? Sent/publishing posts are skipped.`)) return;
    setBulkBusy(true);
    try {
      const r = await api("/api/posts/bulk", { method: "POST", body: JSON.stringify({ action: "delete", ids: selectedPosts }) });
      showToast(`Deleted ${r.affected} post(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
      setSelectedPosts([]);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkReschedulePosts(newTime) {
    if (!selectedPosts.length || !newTime) return;
    setBulkBusy(true);
    try {
      const r = await api("/api/posts/bulk", { method: "POST", body: JSON.stringify({ action: "reschedule", ids: selectedPosts, scheduledFor: newTime }) });
      showToast(`Rescheduled ${r.affected} post(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
      setSelectedPosts([]);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  // ── CSV bulk import ─────────────────────────────────────────────────────

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bulk-posts-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsvFile(file) {
    if (!file) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) throw new Error("CSV needs a header row plus at least one post row.");
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const col = (name) => header.indexOf(name);
      if (col("text") === -1 || col("scheduled_for") === -1) {
        throw new Error('CSV must include "text" and "scheduled_for" columns — download the template below.');
      }
      const rows = grid.slice(1).map((r) => ({
        text: r[col("text")] || "",
        scheduledFor: r[col("scheduled_for")] || "",
        pages: col("pages") !== -1 ? r[col("pages")] || "" : "all",
        imageUrl: col("image_url") !== -1 ? r[col("image_url")] || "" : "",
        linkUrl: col("link_url") !== -1 ? r[col("link_url")] || "" : "",
        firstComment: col("first_comment") !== -1 ? r[col("first_comment")] || "" : "",
        contentType: col("content_type") !== -1 ? r[col("content_type")] || "" : ""
      }));
      const result = await api("/api/posts/import", { method: "POST", body: JSON.stringify({ rows }) });
      setImportResult(result);
      if (result.created > 0) {
        showToast(`Imported ${result.created} post(s)${result.errors.length ? ` — ${result.errors.length} row(s) skipped` : ""}.`, result.errors.length ? "warn" : "ok");
        loadData();
      } else {
        showToast("Nothing imported — check the row errors.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImportBusy(false);
    }
  }

  // ── best-time scheduling ────────────────────────────────────────────────

  function suggestBestTime() {
    // Peak engagement windows (9am / 1pm / 7pm local), keeping at least an
    // hour of clear air from anything already queued.
    const SLOT_HOURS = [9, 13, 19];
    const queued = posts
      .filter((p) => p.status === "scheduled" || p.status === "publishing")
      .map((p) => new Date(p.scheduled_for).getTime());
    const now = new Date();
    for (let day = 0; day < 14; day++) {
      for (const h of SLOT_HOURS) {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, h, 0, 0);
        if (t.getTime() - Date.now() < 15 * 60 * 1000) continue; // FB needs 10+ min lead
        if (queued.some((q) => Math.abs(q - t.getTime()) < 60 * 60 * 1000)) continue;
        setScheduledFor(toLocalInput(t.toISOString()));
        showToast(`Best time picked: ${t.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
        return;
      }
    }
    showToast("Couldn't find a free slot in the next 14 days.", "warn");
  }

  // ── media sources ────────────────────────────────────────────────────────

  function applyImageUrl() {
    const u = urlDraft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { showToast("Enter a valid image URL starting with https://", "error"); return; }
    setImageUrl(u);
    setImageFile(null);
    setShowUrlInput(false);
    setUrlDraft("");
  }

  function clearMedia() {
    setImageFile(null);
    setImageUrl("");
    setUrlDraft("");
    setShowUrlInput(false);
  }

  async function connectGoogleDrive() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!clientId || !apiKey) {
      showToast("Google Drive isn't configured yet — add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY (see README-integrations.md).", "warn");
      return;
    }
    try {
      // Each user signs into their OWN Google account; nothing stored server-side.
      const file = await pickImageFromGoogleDrive({ clientId, apiKey });
      if (!file) return; // user cancelled the picker
      setImageFile(file);
      setImageUrl("");
      showToast(`Added “${file.name}” from Google Drive.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function connectCanva() {
    try {
      const r = await apiFetch("/api/canva/designs");
      if (r.status === 501) {
        showToast("Canva isn't configured yet — set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET (see README-integrations.md).", "warn");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Canva check failed.");
      if (!d.connected) {
        // First time: send this user to Canva to authorize their own account.
        window.location.href = apiUrl(`/api/auth/canva/start?uid=${encodeURIComponent(me?.id || "")}`);
        return;
      }
      setCanvaDesigns(d.designs);
      setShowCanva(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function pickCanvaDesign(designId) {
    setCanvaBusy(true);
    try {
      const r = await apiFetch("/api/canva/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Canva export failed.");
      setImageUrl(d.url);
      setImageFile(null);
      setShowCanva(false);
      showToast("Canva design added to your post.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCanvaBusy(false);
    }
  }

  const hasMedia = !!imageFile || !!imageUrl;
  const [imageFilePreview, setImageFilePreview] = useState(null);
  useEffect(() => {
    if (!imageFile) {
      setImageFilePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImageFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);
  const mediaPreview = imageFile ? imageFilePreview : imageUrl;

  // ── disconnect account ─────────────────────────────────────────────────────

  async function disconnectAccount(id) {
    if (!confirm("Disconnect this Page?")) return;
    try {
      await api(`/api/accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      showToast("Page disconnected.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Disconnect a whole source Facebook account — removes every page/IG
  // account it granted (same policy as the ES Studio disconnect).
  async function disconnectSourceAccount(fbUserId, name, count) {
    if (!confirm(`Disconnect "${name}" and its ${count} page${count === 1 ? "" : "s"}? Scheduled posts targeting these pages will lose those targets.`)) return;
    try {
      const data = await api("/api/accounts/disconnect", {
        method: "POST",
        body: JSON.stringify({ fbUserId })
      });
      setAccounts(data.accounts || []);
      showToast(`Disconnected ${data.removed} page${data.removed === 1 ? "" : "s"}.`, "ok");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Group connected pages by the FB account that granted them (multi-account
  // support). Pages connected before grantor tracking fall under "legacy".
  const accountsBySource = useMemo(() => {
    const map = {};
    for (const a of accounts) {
      const via = a.metadata?.connected_via;
      const key = via?.fb_user_id || "legacy";
      if (!map[key]) {
        map[key] = {
          fbUserId: key,
          name: via?.fb_user_name || "Earlier connection",
          avatar: via?.avatar || null,
          pages: []
        };
      }
      map[key].pages.push(a);
    }
    return Object.values(map);
  }, [accounts]);

  // ── toggle account selection ───────────────────────────────────────────────

  function toggleAccount(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── calendar data ──────────────────────────────────────────────────────────

  const calDays = useMemo(() => {
    const first = startOfMonth(calYear, calMonth);
    const offset = first.getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return cells;
  }, [calYear, calMonth]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const post of posts) {
      const d = new Date(post.scheduled_for);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = d.getDate();
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    }
    return map;
  }, [posts, calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth).toLocaleString(undefined, {
    month: "long", year: "numeric"
  });

  // ── accounts hub: filter + group by sport ───────────────────────────────────

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesText = !q || a.display_name?.toLowerCase().includes(q);
      const matchesSport = acctSport === "all" || (a.category || "Other") === acctSport;
      const matchesPlatform = acctPlatform === "all" || a.platform === acctPlatform;
      return matchesText && matchesSport && matchesPlatform;
    });
  }, [accounts, acctSearch, acctSport, acctPlatform]);

  const platformCounts = useMemo(() => {
    const counts = {};
    for (const a of accounts) counts[a.platform] = (counts[a.platform] || 0) + 1;
    return counts;
  }, [accounts]);

  const accountsBySport = useMemo(() => {
    const groups = {};
    for (const a of filteredAccounts) {
      const key = a.category || "Other";
      (groups[key] ||= []).push(a);
    }
    return groups;
  }, [filteredAccounts]);

  const sportCounts = useMemo(() => {
    const counts = {};
    for (const a of accounts) {
      const key = a.category || "Other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [accounts]);

  // ── calendar: week & day helpers ─────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const anchor = new Date(calAnchor);
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calAnchor]);

  function postsOnDate(dateObj) {
    return posts
      .filter((p) => {
        const d = new Date(p.scheduled_for);
        return d.getFullYear() === dateObj.getFullYear() &&
          d.getMonth() === dateObj.getMonth() &&
          d.getDate() === dateObj.getDate();
      })
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  }

  function toLocalInput(iso) {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  }

  function startEdit(post) {
    setEditDraft({
      body: post.body || "",
      linkUrl: post.link_url || "",
      scheduledFor: post.status === "scheduled" ? toLocalInput(post.scheduled_for) : ""
    });
    setEditing(true);
  }

  async function savePostEdit() {
    try {
      const payload = { body: editDraft.body, linkUrl: editDraft.linkUrl || null };
      if (detailPost.status === "scheduled" && editDraft.scheduledFor) {
        payload.scheduledFor = editDraft.scheduledFor;
      }
      const r = await api(`/api/posts/${detailPost.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setDetailPost(r.post);
      setEditing(false);
      showToast(r.warning ? `Saved — Facebook note: ${r.warning}` : "Post updated.", r.warning ? "warn" : "ok");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function syncAccounts(ids) {
    setSyncing(true);
    try {
      const r = await api("/api/accounts/sync", { method: "POST", body: JSON.stringify({ ids: ids || null }) });
      setAccounts(r.accounts || []);
      const failed = (r.results || []).filter((x) => !x.ok).length;
      showToast(failed ? `Synced with ${failed} token issue(s).` : "Accounts synced.", failed ? "warn" : "ok");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  }

  async function bulkAccount(action, value) {
    if (!selectedAccts.length) { showToast("Select accounts first.", "warn"); return; }
    if (action === "disconnect" && !confirm(`Disconnect ${selectedAccts.length} account(s)?`)) return;
    try {
      const r = await api("/api/accounts/bulk", { method: "POST", body: JSON.stringify({ action, ids: selectedAccts, value }) });
      setAccounts(r.accounts || []);
      setSelectedAccts([]);
      showToast("Bulk action applied.");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  function tokenHealth(a) {
    if (a.publishing_ok === false) return { label: "Token issue", cls: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" };
    if (a.token_expires_at) {
      const days = (new Date(a.token_expires_at).getTime() - Date.now()) / 86400000;
      if (days < 0) return { label: "Expired", cls: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" };
      if (days < 7) return { label: `Expires ${Math.ceil(days)}d`, cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    }
    return { label: "Healthy", cls: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" };
  }

  async function updateCategory(accountId, category) {
    try {
      await api(`/api/accounts/${accountId}`, { method: "PATCH", body: JSON.stringify({ category }) });
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, category } : a)));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (me?.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-gray-950 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800 dark:text-white">Waiting for approval</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
            Your access request is pending review by your Group Head or an admin. You&apos;ll be able to sign in normally once it&apos;s approved.
          </p>
          <button onClick={logout} className="mt-4 rounded-lg border border-slate-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa] dark:bg-gray-950 transition-colors">

      {/* ── Sidebar ── */}
      <aside className="flex w-56 flex-col border-r border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Send size={18} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">EssentiallySports</span>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">Scheduler</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                }`}
              >
                <Icon size={18} className="min-w-[18px]" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {me?.display_name?.[0]?.toUpperCase() || "ES"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-gray-200">{me?.display_name || "EssentiallySports"}</p>
            </div>
            {me && (
              <button onClick={logout} title="Sign out" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-white transition-colors">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-indigo-500" />
            <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch onNavigate={setView} />
            <NotificationsBell />
            <button
              onClick={() => loadData()}
              className="rounded-lg border border-slate-200 dark:border-gray-700 p-2 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* ── DASHBOARD VIEW ── */}
          {view === "dashboard" && <DashboardView onNavigate={setView} />}

          {/* ── SETTINGS VIEW ── */}
          {view === "settings" && <SettingsView />}

          {/* ── MEDIA LIBRARY VIEW ── */}
          {view === "media" && <MediaLibraryView />}

          {view === "queues" && <QueueEditorView accounts={accounts} />}

          {/* ── TEAM VIEW ── */}
          {view === "team" && <TeamView />}

          {/* ── TEMPLATES VIEW ── */}
          {view === "templates" && (
            <TemplatesView
              onUse={(t) => {
                setBody((b) => (b ? `${b}\n\n${t.content || ""}` : t.content || ""));
                setTemplateId(t.id);
                setView("compose");
              }}
            />
          )}

          {/* ── COMPOSE VIEW ── */}
          {view === "compose" && (
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">

              {/* Left: editor */}
              <div className="space-y-4">
                {accounts.length === 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
                    <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No Pages connected</p>
                      <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
                        Go to <button onClick={() => setView("accounts")} className="underline font-medium">Accounts</button> and connect your Facebook Pages first.
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                  <div className="p-4 border-b border-slate-100 dark:border-gray-800">
                    <div className="flex gap-2">
                      {["schedule", "queue", "now"].map((m) => (
                        <button
                          key={m}
                          onClick={() => setPostMode(m)}
                          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                            postMode === m
                              ? "bg-indigo-600 text-white"
                              : "border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                          }`}
                        >
                          {m === "now" ? <Zap size={14} /> : m === "queue" ? <LayoutList size={14} /> : <Clock size={14} />}
                          {m === "now" ? "Post Now" : m === "queue" ? "Add to Queue" : "Schedule"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={7}
                      maxLength={5000}
                      placeholder="Write your post here…"
                      className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />

                    {/* AI assistant toolbar (free/local) */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 p-2">
                      <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400"><Sparkles size={13} /> AI</span>
                      {[
                        { a: "hashtags", label: "# Hashtags" },
                        { a: "emojis", label: "😀 Emojis" },
                        { a: "cta", label: "CTA" },
                        { a: "grammar", label: "Fix grammar" }
                      ].map((b) => (
                        <button key={b.a} type="button" disabled={aiBusy} onClick={() => callAi(b.a)}
                          className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50">
                          {b.label}
                        </button>
                      ))}
                      <select value={aiTone} onChange={(e) => setAiTone(e.target.value)}
                        className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-indigo-700 dark:text-indigo-400 outline-none">
                        <option value="professional">Professional</option>
                        <option value="exciting">Exciting</option>
                        <option value="funny">Funny</option>
                        <option value="breaking">Breaking</option>
                        <option value="minimal">Minimal</option>
                      </select>
                      <button type="button" disabled={aiBusy} onClick={() => callAi("tone")}
                        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        Apply tone
                      </button>
                      {appSettings.defaultHashtags && (
                        <button type="button" onClick={() => setBody((b) => (b ? `${b}\n\n${appSettings.defaultHashtags}` : appSettings.defaultHashtags))}
                          className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                          + Default hashtags
                        </button>
                      )}
                    </div>

                    {/* Content type — feeds the team's per-associate post-count dashboard */}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
                      <Tag size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                      <select value={contentType} onChange={(e) => setContentType(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none">
                        <option value="">Content type (required to schedule/post)</option>
                        <option value="infographic">Infographic</option>
                        <option value="meme_image">Meme / Image</option>
                        <option value="lic">LIC</option>
                      </select>
                    </div>

                    {/* Template picker */}
                    {templates.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
                        <FileText size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                        <select
                          value={templateId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setTemplateId(id);
                            const t = templates.find((x) => x.id === id);
                            if (t) setBody((b) => (b ? `${b}\n\n${t.content || ""}` : t.content || ""));
                          }}
                          className="flex-1 bg-transparent text-sm outline-none"
                        >
                          <option value="">Apply a template…</option>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setView("templates")} className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                          Manage
                        </button>
                      </div>
                    )}

                    {/* Link URL */}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
                      <ExternalLink size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="Add a link — appears in caption (optional)"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
                      />
                      {linkUrl && (
                        <button type="button" onClick={() => setLinkUrl("")} className="text-slate-400 dark:text-gray-500 hover:text-red-500">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* First comment */}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
                      <MessageSquare size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                      <input
                        type="text"
                        value={firstComment}
                        onChange={(e) => setFirstComment(e.target.value)}
                        placeholder="First comment / LIC (optional, posted right after publish)"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
                      />
                      {firstComment && (
                        <button type="button" onClick={() => setFirstComment("")} className="text-slate-400 dark:text-gray-500 hover:text-red-500">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Media panel — multiple sources */}
                    <div className="rounded-lg border border-slate-200 dark:border-gray-800 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Media</p>

                      {hasMedia ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-gray-800/50 p-2.5">
                            {mediaPreview && !(imageFile?.type?.startsWith("video") || guessMediaType(imageUrl) === "video" && !imageFile) ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={mediaPreview} alt="" className="h-14 w-14 rounded object-cover border border-slate-200 dark:border-gray-800" />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded bg-indigo-100 dark:bg-indigo-500/20">
                                <ImagePlus size={20} className="text-indigo-600 dark:text-indigo-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-700 dark:text-gray-200">{imageFile ? imageFile.name : imageUrl}</p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">
                                {(imageFile?.type?.startsWith("video") || (!imageFile && guessMediaType(imageUrl) === "video")) ? "Video" : "Image"}
                                {" · "}{imageFile ? "Uploaded file" : "From URL"}
                              </p>
                            </div>
                            <button type="button" onClick={clearMedia} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-200 dark:hover:bg-gray-700 hover:text-red-500">
                              <X size={16} />
                            </button>
                          </div>

                          {/* Extra media (carousel items) */}
                          {mediaItems.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {mediaItems.map((m, i) => (
                                <div key={`${m.url}-${i}`} className="relative">
                                  {m.type === "video" ? (
                                    <div className="flex h-14 w-14 items-center justify-center rounded border border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-800 text-[9px] font-bold text-slate-500 dark:text-gray-400">VIDEO</div>
                                  ) : (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={m.url} alt="" className="h-14 w-14 rounded object-cover border border-slate-200 dark:border-gray-800" />
                                  )}
                                  <button type="button" onClick={() => setMediaItems((prev) => prev.filter((_, j) => j !== i))}
                                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white hover:bg-red-500">
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add more → carousel (FB/IG/Threads support up to 10) */}
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                            <ImagePlus size={14} />
                            {addingMedia ? "Uploading…" : "Add more (carousel)"}
                            <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={addingMedia}
                              onChange={(e) => { addExtraMedia(e.target.files); e.target.value = ""; }} />
                          </label>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <ImagePlus size={18} className="text-slate-500 dark:text-gray-400" />
                              Upload
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                            </label>
                            <button type="button" onClick={() => setShowLibrary(true)}
                              className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <FolderOpen size={18} className="text-slate-500 dark:text-gray-400" /> Library
                            </button>
                            <button type="button" onClick={() => setShowUrlInput((v) => !v)}
                              className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <LinkIcon size={18} className="text-slate-500 dark:text-gray-400" /> Image URL
                            </button>
                            <button type="button" onClick={connectGoogleDrive}
                              className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#0066da" d="M6 22l4-7H24l-4 7z"/><path fill="#00ac47" d="M2 15l4-7 7 12H6z" transform="translate(-1 0)"/><path fill="#ea4335" d="M8 2h8l7 12h-8z" transform="translate(-1 0)"/><path fill="#ffba00" d="M8 2 1 14l4 7 7-12z"/><path fill="#00832d" d="M6 22l4-7h8l-4 7z"/><path fill="#2684fc" d="M18 15h6l-4 7-2-3z"/></svg>
                              Google Drive
                            </button>
                            <button type="button" onClick={connectCanva}
                              className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 py-3 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-purple-500 text-[9px] font-bold text-white">C</span>
                              Canva
                            </button>
                          </div>

                          {showUrlInput && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                value={urlDraft}
                                onChange={(e) => setUrlDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyImageUrl(); } }}
                                placeholder="Paste image URL (Canva export, Drive public link, etc.)"
                                className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                              <button type="button" onClick={applyImageUrl}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                                Add
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {postMode === "queue" && (
                      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-700 dark:text-indigo-300">
                        <LayoutList size={15} className="shrink-0" />
                        Will be scheduled into the next open queue slot for the selected pages — manage slots under <button type="button" onClick={() => setView("queues")} className="font-semibold underline">Posting Queue</button>.
                      </div>
                    )}

                    {postMode === "schedule" && (() => {
                      // Split scheduledFor "YYYY-MM-DDTHH:MM" into date + time parts
                      const sfDate = scheduledFor ? scheduledFor.slice(0, 10) : "";
                      const sfTime = scheduledFor ? scheduledFor.slice(11, 16) : "";

                      // Today's date string in local time
                      const now = new Date();
                      const todayStr = [
                        now.getFullYear(),
                        String(now.getMonth() + 1).padStart(2, "0"),
                        String(now.getDate()).padStart(2, "0"),
                      ].join("-");
                      const minDateStr = todayStr;
                      const maxDateStr = (() => {
                        const d = new Date(now);
                        d.setDate(d.getDate() + 30);
                        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
                      })();

                      // Generate 5-min slots for the day
                      const allSlots = [];
                      for (let h = 0; h < 24; h++) {
                        for (let m = 0; m < 60; m += 5) {
                          allSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                        }
                      }

                      // If today selected, only show future slots (>= now + 5 min)
                      const isToday = sfDate === todayStr;
                      const minTime = (() => {
                        const cutoff = new Date(now.getTime() + 5 * 60000);
                        return `${String(cutoff.getHours()).padStart(2, "0")}:${String(Math.ceil(cutoff.getMinutes() / 30) * 30 === 60 ? 0 : Math.ceil(cutoff.getMinutes() / 30) * 30).padStart(2, "0")}`;
                      })();
                      const slots = isToday ? allSlots.filter(s => s >= minTime) : allSlots;

                      const handleDateChange = (e) => {
                        const newDate = e.target.value;
                        // If switching to today and current time is in the past, pick first valid slot
                        const isNewToday = newDate === todayStr;
                        let newTime = sfTime;
                        if (isNewToday && sfTime < minTime) {
                          newTime = slots[0] || minTime;
                        }
                        setScheduledFor(newDate && newTime ? `${newDate}T${newTime}` : "");
                      };

                      const handleTimeChange = (e) => {
                        setScheduledFor(sfDate ? `${sfDate}T${e.target.value}` : "");
                      };

                      const fmtSlot = (t) => {
                        const [h, m] = t.split(":").map(Number);
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h % 12 || 12;
                        return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
                      };

                      return (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-gray-200">
                            Schedule date &amp; time
                          </label>
                          <div className="flex gap-2">
                            {/* Date picker */}
                            <input
                              type="date"
                              value={sfDate}
                              min={minDateStr}
                              max={maxDateStr}
                              onChange={handleDateChange}
                              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 outline-none focus:border-indigo-500"
                              required
                            />
                            {/* Time dropdown — 5-min intervals, scrollable */}
                            <select
                              value={sfTime}
                              onChange={handleTimeChange}
                              disabled={!sfDate}
                              size={1}
                              className="w-36 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-700 dark:text-gray-200 outline-none focus:border-indigo-500 disabled:opacity-40"
                              required
                            >
                              {!sfTime && <option value="">Time</option>}
                              {slots.map(s => (
                                <option key={s} value={s}>{fmtSlot(s)}</option>
                              ))}
                            </select>
                            {/* Best time button */}
                            <button type="button" onClick={suggestBestTime}
                              className="shrink-0 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                              title="Pick the next peak-engagement slot">
                              ✨
                            </button>
                          </div>
                          {slots.length === 0 && sfDate === todayStr && (
                            <p className="mt-1.5 text-xs text-amber-500">No more slots today — pick tomorrow.</p>
                          )}
                          <p className="mt-1.5 text-xs text-slate-400 dark:text-gray-500">
                            Up to 30 days ahead. A time within ~10 min posts immediately.
                          </p>
                        </div>
                      );
                    })()}

                    {imageScanning && (
                      <p className="flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-400">
                        <RefreshCw size={12} className="animate-spin" /> Scanning image for compliance…
                      </p>
                    )}
                    {/* Inline compliance check — replaces the old publish-time popup.
                        Flagged posts can't go straight out; edit here, or send for review. */}
                    {hasComplianceFlags && (body.trim() || imageFile || imageUrl) && (
                      <div className="space-y-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-300">
                          <ShieldAlert size={15} /> {totalComplianceFlags} compliance flag{totalComplianceFlags !== 1 ? "s" : ""} — can't publish directly
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

                    <button
                      type="submit"
                      disabled={saving || !accounts.length || imageScanning}
                      title={imageScanning ? "Waiting for the image compliance scan" : undefined}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : postMode === "now" ? (
                        <Zap size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      {saving ? "Publishing…" : postMode === "now" ? "Post Now" : "Schedule Post"}
                    </button>

                    {/* Draft / review actions */}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveDraftOrReview("draft")} disabled={saving || !accounts.length}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50">
                        <FileText size={15} /> Save draft
                      </button>
                      <button type="button" onClick={() => saveDraftOrReview("review")} disabled={saving || !accounts.length}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                        <ShieldCheck size={15} /> Submit for review
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: page selector */}
              <div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <button
                      onClick={() => setPagesCollapsed((v) => !v)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {pagesCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} className="rotate-90" />}
                      Publish to
                    </button>
                    <div className="flex items-center gap-2">
                      {selectedIds.length > 0 && (
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                          {selectedIds.length} selected
                        </span>
                      )}
                    </div>
                  </div>

                  {!pagesCollapsed && accounts.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500 dark:text-gray-400 border-t border-slate-100 dark:border-gray-800">No Pages connected yet.</p>
                  ) : !pagesCollapsed && (
                    <>
                      {/* Search + select-all */}
                      <div className="border-t border-b border-slate-100 dark:border-gray-800 px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
                          <Search size={14} className="text-slate-400 dark:text-gray-500" />
                          <input
                            value={composeSearch}
                            onChange={(e) => setComposeSearch(e.target.value)}
                            placeholder="Search pages…"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
                          />
                          {composeSearch && (
                            <button onClick={() => setComposeSearch("")} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-1 text-xs">
                          <button
                            onClick={() => setSelectedIds(accounts.map((a) => a.id))}
                            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            onClick={() => setSelectedIds([])}
                            className="font-medium text-slate-500 dark:text-gray-400 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto p-3">
                        {(() => {
                          const q = composeSearch.trim().toLowerCase();
                          const filtered = q
                            ? accounts.filter((a) => a.display_name?.toLowerCase().includes(q))
                            : accounts;
                          if (!filtered.length) {
                            return <p className="px-1 py-2 text-sm text-slate-500 dark:text-gray-400">No pages match “{composeSearch}”.</p>;
                          }
                          return filtered.map((account) => (
                            <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(account.id)}
                                onChange={() => toggleAccount(account.id)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                              />
                              <div className="relative">
                                {account.avatar_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={account.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${PLATFORM_META[account.platform]?.bg || "bg-indigo-100 dark:bg-indigo-500/20"}`}>
                                    <PlatformIcon platform={account.platform} size={14} />
                                  </div>
                                )}
                                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                                  <PlatformIcon platform={account.platform} size={8} />
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{account.display_name}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{PLATFORM_META[account.platform]?.label || account.platform}</p>
                              </div>
                            </label>
                          ));
                        })()}
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-100 dark:border-gray-800 px-4 py-2.5">
                    <button
                      onClick={() => setView("accounts")}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      <Plus size={13} /> Connect more Pages
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── QUEUE VIEW ── */}
          {view === "queue" && (
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="flex items-center gap-2">
                {authors.length > 0 && (
                  <>
                    <Users size={14} className="text-slate-400 dark:text-gray-500" />
                    <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-slate-600 dark:text-gray-300 outline-none focus:border-indigo-500">
                      <option value="all">Everyone</option>
                      {authors.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                      <option value="none">Unattributed</option>
                    </select>
                  </>
                )}
                <button onClick={() => { setImportResult(null); setShowImport(true); }}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                  <FileText size={14} /> Import CSV
                </button>
              </div>

              {selectedPosts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5">
                  <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{selectedPosts.length} selected</span>
                  <input
                    type="datetime-local"
                    onChange={(e) => { if (e.target.value) { bulkReschedulePosts(new Date(e.target.value).toISOString()); e.target.value = ""; } }}
                    disabled={bulkBusy}
                    className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 outline-none"
                    title="Reschedule selected"
                  />
                  <button onClick={bulkDeletePosts} disabled={bulkBusy} className="rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">Delete</button>
                  <button onClick={() => setSelectedPosts([])} className="ml-auto text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline">Clear</button>
                </div>
              )}

              {(() => {
                const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));
                const visiblePosts = authorFilter === "all" ? posts
                  : authorFilter === "none" ? posts.filter((p) => !p.created_by)
                  : posts.filter((p) => p.created_by === authorFilter);

                if (loading) return <p className="text-center text-sm text-slate-500 dark:text-gray-400 py-16">Loading…</p>;
                if (posts.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
                      <LayoutList size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
                      <p className="text-slate-500 dark:text-gray-400 text-sm">No posts yet.</p>
                      <button onClick={() => setView("compose")} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                        Create your first post →
                      </button>
                    </div>
                  );
                }
                if (visiblePosts.length === 0) {
                  return <p className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">No posts from this person.</p>;
                }
                return (
                  <div className="space-y-3">
                    {visiblePosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        author={authorMap[post.created_by]}
                        onDelete={deletePost}
                        onOpen={() => setDetailPost(post)}
                        selected={selectedPosts.includes(post.id)}
                        onToggleSelect={() => togglePostSelect(post.id)}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── CALENDAR VIEW ── */}
          {view === "calendar" && (
            <div className="mx-auto max-w-5xl">
              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (calView === "month") {
                        if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1);
                      } else {
                        const d = new Date(calAnchor);
                        d.setDate(d.getDate() - (calView === "week" ? 7 : 1));
                        setCalAnchor(d.toISOString());
                      }
                    }}
                    className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (calView === "month") {
                        if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1);
                      } else {
                        const d = new Date(calAnchor);
                        d.setDate(d.getDate() + (calView === "week" ? 7 : 1));
                        setCalAnchor(d.toISOString());
                      }
                    }}
                    className="rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <p className="ml-1 font-semibold text-slate-800 dark:text-white">
                    {calView === "month" ? monthLabel
                      : calView === "week" ? `Week of ${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : calView === "day" ? new Date(calAnchor).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
                      : "All posts"}
                  </p>
                </div>

                <div className="flex rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5">
                  {["month", "week", "day", "list"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setCalView(v)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                        calView === v ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* MONTH */}
              {calView === "month" && (
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-slate-100 dark:border-gray-800">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 dark:text-gray-500">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calDays.map((day, i) => {
                      const td = new Date();
                      const isToday = day && calYear === td.getFullYear() && calMonth === td.getMonth() && day === td.getDate();
                      const dayPosts = day ? (postsByDay[day] || []) : [];
                      return (
                        <div key={i} className={`min-h-[110px] border-b border-r border-slate-100 dark:border-gray-800 p-1.5 ${!day ? "bg-slate-50 dark:bg-gray-800/50" : ""}`}>
                          {day && (
                            <>
                              <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-gray-200"}`}>
                                {day}
                              </span>
                              <div className="space-y-0.5">
                                {dayPosts.slice(0, 4).map((post) => (
                                  <button
                                    key={post.id}
                                    onClick={() => setDetailPost(post)}
                                    className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-80 ${
                                      post.status === "sent" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300"
                                      : post.status === "failed" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                                      : post.status === "deleted" ? "bg-slate-700 dark:bg-gray-700 text-white"
                                      : post.status === "publishing" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                      : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                                    }`}
                                    title={post.body}
                                  >
                                    {post.image_url && (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={post.image_url} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" />
                                    )}
                                    <span className="truncate">{new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })} {post.body.slice(0, 22)}</span>
                                  </button>
                                ))}
                                {dayPosts.length > 4 && (
                                  <p className="text-[10px] text-slate-400 dark:text-gray-500">+{dayPosts.length - 4} more</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WEEK */}
              {calView === "week" && (
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((d) => {
                    const dayPosts = postsOnDate(d);
                    const td = new Date();
                    const isToday = d.toDateString() === td.toDateString();
                    return (
                      <div key={d.toISOString()} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                        <div className={`px-2 py-2 text-center border-b border-slate-100 dark:border-gray-800 ${isToday ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                          <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-gray-500">{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                          <p className={`text-sm font-bold ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-gray-200"}`}>{d.getDate()}</p>
                        </div>
                        <div className="min-h-[300px] space-y-1 p-1.5">
                          {dayPosts.map((post) => (
                            <button
                              key={post.id}
                              onClick={() => setDetailPost(post)}
                              className={`block w-full overflow-hidden rounded text-left text-[10px] font-medium leading-tight hover:opacity-80 ${
                                post.status === "sent" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300"
                                : post.status === "failed" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                                : post.status === "deleted" ? "bg-slate-700 dark:bg-gray-700 text-white"
                                : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                              }`}
                            >
                              {post.image_url && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={post.image_url} alt="" className="h-14 w-full object-cover" />
                              )}
                              <span className="block px-1.5 py-1">
                                {new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}<br />
                                {post.body.slice(0, 40)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DAY */}
              {calView === "day" && (
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-slate-100 dark:divide-gray-800">
                  {postsOnDate(new Date(calAnchor)).length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500 dark:text-gray-400">No posts on this day.</p>
                  ) : (
                    postsOnDate(new Date(calAnchor)).map((post) => (
                      <CalRow key={post.id} post={post} onClick={() => setDetailPost(post)} />
                    ))
                  )}
                </div>
              )}

              {/* LIST */}
              {calView === "list" && (
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-slate-100 dark:divide-gray-800">
                  {posts.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500 dark:text-gray-400">No posts yet.</p>
                  ) : (
                    [...posts].sort((a, b) => new Date(b.scheduled_for) - new Date(a.scheduled_for))
                      .map((post) => (
                        <CalRow key={post.id} post={post} onClick={() => setDetailPost(post)} showDate />
                      ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNTS HUB ── */}
          {view === "accounts" && (
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex gap-2 border-b border-slate-200 dark:border-gray-800">
                <button
                  onClick={() => setAccountsTab("manage")}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${accountsTab === "manage" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
                >
                  Manage Accounts
                </button>
                {canManageAccounts && (
                  <button
                    onClick={() => setAccountsTab("connect")}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${accountsTab === "connect" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"}`}
                  >
                    Connect Accounts
                  </button>
                )}
              </div>

              {accountsTab === "connect" && canManageAccounts && <ConnectAccountsView onConnectMeta={connectFacebook} />}

              {accountsTab === "manage" && (
              <div className="mx-auto max-w-4xl space-y-4">
              {/* Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">Manage Accounts</p>
                  <p className="text-sm text-slate-500 dark:text-gray-400">{accounts.length} page{accounts.length !== 1 ? "s" : ""} connected across {Object.keys(sportCounts).length} sport{Object.keys(sportCounts).length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setView("compose")}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50"
                  >
                    <Plus size={15} /> Create Post
                  </button>
                  {accounts.length > 0 && (
                    <button
                      onClick={() => syncAccounts(null)}
                      disabled={syncing}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50 disabled:opacity-50"
                    >
                      <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Sync all
                    </button>
                  )}
                  {canManageAccounts && (
                    <button
                      onClick={() => setAccountsTab("connect")}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <LinkIcon size={15} /> Connect Pages
                    </button>
                  )}
                </div>
              </div>

              {/* Source accounts — pages grouped by the FB account that granted them */}
              {accounts.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-gray-200">Connected Facebook accounts</p>
                    {canManageAccounts && (
                      <button
                        onClick={() => connectFacebook(true)}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                        title="Sign in with a different Facebook account to add its pages"
                      >
                        <Plus size={13} /> Connect another account
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-gray-800">
                    {accountsBySource.map((src) => (
                      <div key={src.fbUserId} className="flex items-center gap-3 px-4 py-2.5">
                        {src.avatar ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={src.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
                            <Facebook size={14} className="text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{src.name}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">
                            {src.pages.length} page{src.pages.length !== 1 ? "s" : ""}
                            {src.fbUserId === "legacy" && " · connected before account tracking"}
                          </p>
                        </div>
                        {canManageAccounts && (
                          <button
                            onClick={() => disconnectSourceAccount(src.fbUserId, src.name, src.pages.length)}
                            className="rounded-lg border border-red-200 dark:border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            Disconnect account
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      While the Meta app is in development mode, each Facebook account used here must be added as a <strong>Tester</strong> in the Meta dashboard (App Roles) before it can connect.
                    </p>
                  </div>
                </div>
              )}

              {accounts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-12 text-center shadow-sm">
                  <Facebook size={32} className="mx-auto text-slate-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-gray-300">No Pages connected yet</p>
                  {canManageAccounts ? (
                    <>
                      <p className="mt-1 text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                        Click <strong>Connect Pages</strong>. In the Facebook popup, <strong>check your Page(s)</strong> before saving.
                      </p>
                      <button
                        onClick={() => connectFacebook(false)}
                        disabled={saving}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Facebook size={15} /> Connect now
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                      Ask an admin or your division's Group Head to connect a Page.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
                    <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
                      <Search size={14} className="text-slate-400 dark:text-gray-500" />
                      <input
                        value={acctSearch}
                        onChange={(e) => setAcctSearch(e.target.value)}
                        placeholder="Search pages…"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
                      />
                      {acctSearch && (
                        <button onClick={() => setAcctSearch("")} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"><X size={13} /></button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={acctPlatform === "all" ? "facebook" : acctPlatform} size={14} />
                      <select
                        value={acctPlatform}
                        onChange={(e) => setAcctPlatform(e.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">All platforms ({accounts.length})</option>
                        {Object.keys(platformCounts).map((p) => (
                          <option key={p} value={p}>{PLATFORM_META[p]?.label || p} ({platformCounts[p]})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter size={14} className="text-slate-400 dark:text-gray-500" />
                      <select
                        value={acctSport}
                        onChange={(e) => setAcctSport(e.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">All sports ({accounts.length})</option>
                        {SPORTS.filter((s) => sportCounts[s]).map((s) => (
                          <option key={s} value={s}>{s} ({sportCounts[s]})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Bulk action bar */}
                  {selectedAccts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5">
                      <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{selectedAccts.length} selected</span>
                      <button onClick={() => syncAccounts(selectedAccts)} className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">Sync</button>
                      {canManageAccounts && (
                        <>
                          <select onChange={(e) => { if (e.target.value) { bulkAccount("category", e.target.value); e.target.value = ""; } }}
                            className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 outline-none" defaultValue="">
                            <option value="" disabled>Set sport…</option>
                            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => bulkAccount("disconnect")} className="rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">Disconnect</button>
                        </>
                      )}
                      <button onClick={() => setSelectedAccts([])} className="ml-auto text-xs font-medium text-slate-500 dark:text-gray-400 hover:underline">Clear</button>
                    </div>
                  )}

                  {/* Sport groups */}
                  {Object.keys(accountsBySport).length === 0 ? (
                    <p className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-slate-500 dark:text-gray-400 shadow-sm">
                      No pages match your filter.
                    </p>
                  ) : (
                    SPORTS.filter((s) => accountsBySport[s]).map((sport) => (
                      <div key={sport} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 px-4 py-2">
                          <p className="text-sm font-bold text-slate-700 dark:text-gray-200">{sport}</p>
                          <span className="text-xs text-slate-400 dark:text-gray-500">{accountsBySport[sport].length} page{accountsBySport[sport].length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-gray-800">
                          {accountsBySport[sport].map((account) => {
                            const health = tokenHealth(account);
                            return (
                            <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedAccts.includes(account.id)}
                                onChange={() => setSelectedAccts((p) => p.includes(account.id) ? p.filter((x) => x !== account.id) : [...p, account.id])}
                                className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                              />
                              <div className="relative">
                                {account.avatar_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={account.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${PLATFORM_META[account.platform]?.bg || "bg-indigo-100 dark:bg-indigo-500/20"}`}>
                                    <PlatformIcon platform={account.platform} size={16} />
                                  </div>
                                )}
                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                                  <PlatformIcon platform={account.platform} size={9} />
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-800 dark:text-white truncate">{account.display_name}</p>
                                <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                                  {PLATFORM_META[account.platform]?.label || account.platform}
                                  {account.followers != null && <span>· {account.followers.toLocaleString()} followers</span>}
                                  {account.page_likes != null && <span>· {account.page_likes.toLocaleString()} likes</span>}
                                </p>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.cls}`} title={account.last_synced_at ? `Last sync ${new Date(account.last_synced_at).toLocaleString()}` : "Not synced yet"}>
                                {health.label}
                              </span>
                              {canManageAccounts ? (
                                <select
                                  value={account.category || "Other"}
                                  onChange={(e) => updateCategory(account.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 dark:border-gray-800 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                  title="Change sport"
                                >
                                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-gray-400">{account.category || "Other"}</span>
                              )}
                              {canManageAccounts && (
                                <button
                                  onClick={() => disconnectAccount(account.id)}
                                  className="rounded-lg border border-red-200 dark:border-red-500/30 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  title="Disconnect"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
              </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ── Page selection modal ── */}
      {fetchedPages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">Select Pages to connect</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  {fetchedGrantor?.fb_user_name && <>from <strong>{fetchedGrantor.fb_user_name}</strong> · </>}
                  {fetchedPages.length} found · {pagePicks.length} selected
                </p>
              </div>
              <button
                onClick={() => { setFetchedPages(null); setFetchedGrantor(null); setPagePicks([]); setModalSearch(""); }}
                className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search + select-all */}
            <div className="border-b border-slate-100 dark:border-gray-800 px-4 py-2.5 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5">
                <Search size={14} className="text-slate-400 dark:text-gray-500" />
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search pages…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
                  autoFocus
                />
                {modalSearch && (
                  <button onClick={() => setModalSearch("")} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between px-1 text-xs">
                <button
                  onClick={() => setPagePicks(fetchedPages.map((p) => p.id))}
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setPagePicks([])}
                  className="font-medium text-slate-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {(() => {
                const q = modalSearch.trim().toLowerCase();
                const filtered = q
                  ? fetchedPages.filter((p) => p.name?.toLowerCase().includes(q))
                  : fetchedPages;
                if (!filtered.length) {
                  return <p className="px-1 py-3 text-sm text-slate-500 dark:text-gray-400">No pages match “{modalSearch}”.</p>;
                }
                return filtered.map((page) => (
                  <label key={page.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                    <input
                      type="checkbox"
                      checked={pagePicks.includes(page.id)}
                      onChange={() =>
                        setPagePicks((prev) =>
                          prev.includes(page.id) ? prev.filter((x) => x !== page.id) : [...prev, page.id]
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
                    />
                    <div className="relative">
                      {page.picture ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={page.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${PLATFORM_META[page.platform]?.bg || "bg-indigo-100 dark:bg-indigo-500/20"}`}>
                          <PlatformIcon platform={page.platform} size={16} />
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-gray-900 ring-1 ring-slate-200 dark:ring-gray-700">
                        <PlatformIcon platform={page.platform} size={9} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-white">{page.name}</span>
                      <span className="text-xs text-slate-500 dark:text-gray-400">{PLATFORM_META[page.platform]?.label || page.platform}</span>
                    </div>
                  </label>
                ));
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-gray-800 px-5 py-3">
              <button
                onClick={() => { setFetchedPages(null); setPagePicks([]); setModalSearch(""); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmFacebookPages}
                disabled={saving || !pagePicks.length}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Connect selected ({pagePicks.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Media library picker modal (compose "Library" button) ── */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowLibrary(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800 dark:text-white">Choose from Media Library</p>
              <button onClick={() => setShowLibrary(false)} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <MediaLibraryView
              onPick={(asset) => {
                setImageUrl(asset.url);
                setImageFile(null);
                setShowLibrary(false);
                api(`/api/media/${asset.id}`, { method: "PATCH", body: JSON.stringify({ markUsed: true }) }).catch(() => {});
              }}
            />
          </div>
        </div>
      )}

      {/* ── Canva design picker ── */}
      {showCanva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !canvaBusy && setShowCanva(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800 dark:text-white">Choose a Canva design</p>
              <button onClick={() => setShowCanva(false)} disabled={canvaBusy} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            {canvaBusy && <p className="mb-3 text-sm text-indigo-600 dark:text-indigo-400">Exporting design from Canva…</p>}
            {canvaDesigns.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400 dark:text-gray-500">No designs found in your Canva account yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {canvaDesigns.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={canvaBusy}
                    onClick={() => pickCanvaDesign(d.id)}
                    className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 text-left hover:border-indigo-400 hover:shadow disabled:opacity-50"
                  >
                    {d.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.thumbnail} alt={d.title} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600"><ImagePlus size={22} /></div>
                    )}
                    <p className="truncate px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-gray-200">{d.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CSV bulk import ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !importBusy && setShowImport(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-800 dark:text-white">Bulk import posts from CSV</p>
              <button onClick={() => setShowImport(false)} disabled={importBusy} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <p className="mb-3 text-sm text-slate-500 dark:text-gray-400">
              Columns: <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">text</code> and <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">scheduled_for</code> are
              required; <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">pages</code> (names or “all”), <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">image_url</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">link_url</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">first_comment</code>, <code className="rounded bg-slate-100 dark:bg-gray-800 px-1">content_type</code> (infographic/meme_image/lic) are optional — unlike single-post scheduling, bulk rows don't require a content type.
              Imported posts are queued and publish automatically at their scheduled time. Up to 200 rows.
            </p>
            <div className="flex items-center gap-2">
              <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 ${importBusy ? "pointer-events-none opacity-50" : ""}`}>
                <ImagePlus size={15} /> {importBusy ? "Importing…" : "Choose CSV file"}
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importCsvFile(f); }} />
              </label>
              <button onClick={downloadCsvTemplate}
                className="rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                Download template
              </button>
            </div>
            {importResult && (
              <div className="mt-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3 text-sm">
                <p className="font-medium text-slate-700 dark:text-gray-200">
                  ✓ {importResult.created} post(s) imported{importResult.errors.length ? ` · ${importResult.errors.length} row(s) skipped:` : "."}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                    {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Post detail drawer ── */}
      {detailPost && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => { setDetailPost(null); setEditing(false); }}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 px-5 py-4">
              <p className="font-semibold text-slate-800 dark:text-white">{editing ? "Edit post" : "Post details"}</p>
              <div className="flex items-center gap-1">
                {!editing && detailPost.status !== "sent" && detailPost.status !== "publishing" && (
                  <button onClick={() => startEdit(detailPost)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button onClick={() => { setDetailPost(null); setEditing(false); }} className="rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800">
                  <X size={18} />
                </button>
              </div>
            </div>

            {editing ? (
              /* EDIT MODE */
              <div className="p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Caption &amp; hashtags</label>
                  <textarea
                    value={editDraft.body}
                    onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                    rows={7}
                    maxLength={5000}
                    className="w-full resize-none rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Link</label>
                  <input
                    type="url"
                    value={editDraft.linkUrl}
                    onChange={(e) => setEditDraft((d) => ({ ...d, linkUrl: e.target.value }))}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                {detailPost.status === "scheduled" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Schedule time</label>
                    <input
                      type="datetime-local"
                      value={editDraft.scheduledFor}
                      onChange={(e) => setEditDraft((d) => ({ ...d, scheduledFor: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">Caption &amp; time changes are pushed to Facebook too. (Image can&apos;t be changed on a scheduled post.)</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-200 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50">
                    Cancel
                  </button>
                  <button onClick={savePostEdit} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                    <CheckCircle2 size={15} /> Save changes
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[detailPost.status]}`}>
                    {statusLabel(detailPost.status)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
                    <Clock size={12} /> {fmt(detailPost.scheduled_for)}
                  </span>
                  {authors.find((a) => a.id === detailPost.created_by) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                      Posted by {authors.find((a) => a.id === detailPost.created_by)?.display_name}
                    </span>
                  )}
                </div>

                {detailPost.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={detailPost.image_url} alt="" className="w-full rounded-lg border border-slate-200 dark:border-gray-800 object-cover" />
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-gray-200">{detailPost.body}</p>

                {detailPost.link_url && (
                  <a href={detailPost.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline break-all">
                    <ExternalLink size={13} /> {detailPost.link_url}
                  </a>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">Target pages</p>
                  <div className="space-y-2">
                    {(detailPost.post_targets || []).map((t) => {
                      const url = externalPostUrl(t.social_accounts?.platform || t.platform, t.external_post_id);
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-gray-800 p-2.5">
                          <PlatformIcon platform={t.social_accounts?.platform || t.platform} size={15} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{t.social_accounts?.display_name || "Page"}</p>
                            <p className="text-xs capitalize text-slate-500 dark:text-gray-400">{t.status}</p>
                          </div>
                          {t.status === "sent" && url && (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                              <ExternalLink size={12} /> View
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {detailPost.last_error && (
                  <p className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">{detailPost.last_error}</p>
                )}

                {/* Approval workflow — approve/reject is restricted to admins,
                    or a Group Head reviewing their own division's posts. */}
                {detailPost.status === "pending_review" && (() => {
                  const authorDivisionId = authors.find((a) => a.id === detailPost.created_by)?.division_id;
                  const canReview = me?.role === "admin" || (me?.is_group_head && authorDivisionId && authorDivisionId === me?.division_id);
                  return (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                      <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Pending review — won't go out until approved</p>
                      {canReview ? (
                        <div className="flex gap-2">
                          <button onClick={() => reviewPost(detailPost.id, "approve")}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                            <CheckCircle2 size={14} /> Approve &amp; publish
                          </button>
                          <button onClick={() => reviewPost(detailPost.id, "reject")}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 dark:text-amber-300">Only an admin or this post's division Group Head can approve/reject it.</p>
                      )}
                    </div>
                  );
                })()}

                {(detailPost.status === "rejected" || detailPost.status === "draft") && (
                  <button onClick={() => reviewPost(detailPost.id, "submit")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20">
                    <ShieldCheck size={14} /> {detailPost.status === "rejected" ? "Resubmit for review" : "Submit for review"}
                  </button>
                )}

                {(detailPost.status === "scheduled" || detailPost.status === "failed" || detailPost.status === "draft" || detailPost.status === "rejected" || detailPost.status === "approved" || detailPost.status === "pending_review") && (
                  <button
                    onClick={() => { deletePost(detailPost.id); setDetailPost(null); }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={15} /> Delete post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm ${
          toast.type === "error" ? "bg-red-600 text-white"
          : toast.type === "warn" ? "bg-amber-500 text-white"
          : "bg-green-600 text-white"
        }`}>
          {toast.type === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CalRow: a post row for Day / List calendar views ────────────────────────

function CalRow({ post, onClick, showDate }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-800/50">
      {post.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={post.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200 dark:border-gray-800" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600"><ImagePlus size={16} /></div>
      )}
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
        {statusLabel(post.status)}
      </span>
      <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-gray-400">
        {showDate
          ? fmt(post.scheduled_for)
          : new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true })}
      </span>
      <span className="flex-1 truncate text-sm text-slate-700 dark:text-gray-200">{post.body}</span>
      {(post.post_targets || []).length > 0 && (
        <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">
          {post.post_targets.length} page{post.post_targets.length !== 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}

// ─── PostCard sub-component ───────────────────────────────────────────────────

function PostCard({ post, author, onDelete, onOpen, selected, onToggleSelect }) {
  const targets = post.post_targets || [];
  const canDelete = post.status === "scheduled" || post.status === "failed";

  return (
    <article className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        {canDelete && onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-gray-700 accent-indigo-600"
          />
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
              {statusLabel(post.status)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
              <Clock size={12} />
              {fmt(post.scheduled_for)}
            </span>
            {author && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                {author.display_name}
              </span>
            )}
            {targets.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-slate-600 dark:text-gray-300">
                <Facebook size={10} className="text-blue-600" />
                {t.social_accounts?.display_name || "Page"}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-3">
            {post.body}
          </p>
          {post.link_url && (
            <a
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate"
            >
              <ExternalLink size={11} />
              {post.link_url}
            </a>
          )}
          {post.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.image_url} alt="" className="mt-3 h-24 rounded-lg object-cover border border-slate-200 dark:border-gray-800" />
          )}
          {post.status === "failed" && targets.filter(t => t.last_error).map((t, i) => (
            <p key={i} className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
              <XCircle size={12} className="mt-0.5 shrink-0" />
              <span><strong>{t.social_accounts?.display_name}:</strong> {t.last_error}</span>
            </p>
          ))}
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="shrink-0 rounded-lg p-2 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            title="Delete post"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </article>
  );
}
