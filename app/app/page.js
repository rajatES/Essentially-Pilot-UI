"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Send, Calendar, Users, Plus, RefreshCw, Clock, X, LayoutList,
  Search, FileText, Image as ImageIcon, LogOut,
  CheckCircle2, LayoutDashboard, Settings as SettingsIcon
} from "lucide-react";
import { apiFetch, apiJson, getToken, clearToken } from "@/lib/apiClient";
import { PLATFORM_META, PlatformIcon } from "@/lib/platformMeta";
import { usePostsData, usePostsInvalidate } from "@/lib/queries";
import ToastProvider, { useToast } from "@/components/common/ToastProvider";
import DashboardView from "@/components/dashboard/DashboardView";
import SettingsView, { applyDarkMode } from "@/components/settings/SettingsView";
import QueueEditorView from "@/components/settings/QueueEditorView";
import GlobalSearch from "@/components/common/GlobalSearch";
import NotificationsBell from "@/components/common/NotificationsBell";
import MediaLibraryView from "@/components/media/MediaLibraryView";
import TemplatesView from "@/components/templates/TemplatesView";
import TeamView from "@/components/team/TeamView";
import PostsView from "@/components/posts/PostsView";
import PostDetailDrawer from "@/components/posts/PostDetailDrawer";
import CalendarView from "@/components/calendar/CalendarView";
import AccountsView from "@/components/accounts/AccountsView";
import ComposeView from "@/components/compose/ComposeView";
import { useRouter } from "next/navigation";

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

// ─── entry: toast context wraps the shell ───────────────────────────────────

export default function AppPage() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

// ─── app shell — auth, nav, FB connect flow; views are components ───────────

function AppShell() {
  const router = useRouter();
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const { data: postsData } = usePostsData();
  const accounts = useMemo(() => postsData?.accounts || [], [postsData]);

  const [me, setMe] = useState(null);
  const [view, setView] = useState("dashboard");
  const [detailPost, setDetailPost] = useState(null); // post shown in the shared drawer
  const [appSettings, setAppSettings] = useState({});
  const [templates, setTemplates] = useState([]);

  // Composer prefill (template "Use", post Duplicate, calendar click-day).
  // Bumping nonce remounts ComposeView so the prefill is consumed exactly once.
  const [composePrefill, setComposePrefill] = useState({ nonce: 0 });
  function openCompose(prefill = {}) {
    setComposePrefill((p) => ({ nonce: p.nonce + 1, ...prefill }));
    setView("compose");
  }

  // facebook connect (JS SDK popup) state
  const [fbReady, setFbReady] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);
  const [fetchedPages, setFetchedPages] = useState(null); // null = modal closed
  const [fetchedGrantor, setFetchedGrantor] = useState(null); // FB account that granted the pages being confirmed
  const [pagePicks, setPagePicks] = useState([]);
  const [modalSearch, setModalSearch] = useState("");   // search inside connect modal

  // ── auth gate ──────────────────────────────────────────────────────────────
  // With JWT-in-localStorage there's no cookie for edge middleware to read, so
  // the /app route is gated client-side: no token → straight to /login.
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  // ── initial load: OAuth returns, post verify, settings, templates, me ─────

  useEffect(() => {
    if (!getToken()) return; // not logged in — the auth-gate effect redirects
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
      invalidatePosts();
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
      invalidatePosts();
    }
    // Re-check recent posts against the platforms (deleted after publishing?
    // native-scheduled post gone live?) and refresh if anything changed.
    apiFetch("/api/posts/verify", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.deleted > 0 || d.published > 0) {
          invalidatePosts();
          if (d.deleted > 0) showToast(`${d.deleted} post(s) were deleted on the platform — statuses updated.`, "warn");
          if (d.published > 0) showToast(`${d.published} scheduled post(s) went live.`, "ok");
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
    setFbBusy(true);
    try {
      const data = await apiJson("/api/social/facebook/fetch-pages", {
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
      setFbBusy(false);
    }
  }

  async function confirmFacebookPages() {
    const chosen = fetchedPages.filter((p) => pagePicks.includes(p.id));
    if (!chosen.length) { showToast("Select at least one Page.", "error"); return; }

    setFbBusy(true);
    try {
      const data = await apiJson("/api/social/facebook/confirm-pages", {
        method: "POST",
        body: JSON.stringify({ pages: chosen, grantor: fetchedGrantor })
      });
      setFetchedPages(null);
      setFetchedGrantor(null);
      setPagePicks([]);
      setModalSearch("");
      showToast(`Connected ${data.connected} page${data.connected === 1 ? "" : "s"}.`, "ok");
      invalidatePosts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setFbBusy(false);
    }
  }

  // Connecting/disconnecting/recategorizing Pages is restricted to admins and
  // Group Heads — everyone else gets a read-only view of Manage Accounts.
  const canManageAccounts = me?.role === "admin" || !!me?.is_group_head;

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
              onClick={() => invalidatePosts()}
              className="rounded-lg border border-slate-200 dark:border-gray-700 p-2 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">

          {view === "dashboard" && <DashboardView onNavigate={setView} />}
          {view === "settings" && <SettingsView />}
          {view === "media" && <MediaLibraryView />}
          {view === "queues" && <QueueEditorView accounts={accounts} />}
          {view === "team" && <TeamView />}

          {view === "templates" && (
            <TemplatesView onUse={(t) => openCompose({ templateText: t.content || "", templateId: t.id })} />
          )}

          {view === "queue" && <PostsView onOpenPost={setDetailPost} onNavigate={setView} onCompose={openCompose} />}
          {view === "calendar" && <CalendarView onOpenPost={setDetailPost} onCompose={openCompose} />}

          {view === "accounts" && (
            <AccountsView
              me={me}
              canManageAccounts={canManageAccounts}
              onConnectFacebook={connectFacebook}
              connectBusy={fbBusy}
              onNavigate={setView}
            />
          )}

          {view === "compose" && (
            <ComposeView
              key={composePrefill.nonce}
              prefill={composePrefill}
              appSettings={appSettings}
              me={me}
              templates={templates}
              onNavigate={setView}
              onDone={() => setView("queue")}
            />
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
                disabled={fbBusy || !pagePicks.length}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {fbBusy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Connect selected ({pagePicks.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post detail drawer (shared by Posts + Calendar) ── */}
      {detailPost && (
        <PostDetailDrawer
          key={detailPost.id}
          post={detailPost}
          authors={postsData?.authors || []}
          me={me}
          onClose={() => setDetailPost(null)}
        />
      )}
    </div>
  );
}
