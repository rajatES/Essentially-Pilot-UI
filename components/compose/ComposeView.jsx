"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ExternalLink, FileText, MessageSquare, Tag, X } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import { useToast } from "@/components/common/ToastProvider";
import { usePostsData, usePostsInvalidate } from "@/lib/queries";
import { validateComposer } from "@/lib/platformRules";
import useComposerState from "./useComposerState";
import useCompliance from "./useCompliance";
import AccountPanel from "./AccountPanel";
import CaptionEditor from "./CaptionEditor";
import MediaPanel from "./MediaPanel";
import PlatformOptionsPanel from "./PlatformOptionsPanel";
import ValidationPanel from "./ValidationPanel";
import CompliancePanel from "./CompliancePanel";
import ScheduleActions from "./ScheduleActions";
import PreviewPane from "./PreviewPane";

// SocialPilot-style 3-panel Create Post: accounts (left) → content (center)
// → live per-platform preview (right). Remounted by the shell via a key when
// a prefill (template / duplicate / calendar day) arrives.
export default function ComposeView({ prefill, appSettings, me, templates, onNavigate, onDone }) {
  const showToast = useToast();
  const invalidatePosts = usePostsInvalidate();
  const { data } = usePostsData();
  const accounts = useMemo(() => data?.accounts || [], [data]);

  const { state, update, selectedPlatforms, effectiveCaption, accountFor } =
    useComposerState({ prefill, appSettings, accounts });
  const compliance = useCompliance({ state, accounts });
  const [saving, setSaving] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    try { return localStorage.getItem("composer-accounts-collapsed") === "1"; } catch { return false; }
  });

  const { errorsByPlatform, hasErrors } = useMemo(
    () => validateComposer(state, selectedPlatforms),
    [state, selectedPlatforms],
  );

  const ctaDisabled =
    hasErrors ||
    !state.selectedIds.length ||
    !state.body.trim() ||
    !state.contentType ||
    compliance.imageScanning ||
    (state.mode === "schedule" && !state.scheduledFor);
  const ctaDisabledReason = !state.selectedIds.length ? "Select at least one account"
    : !state.body.trim() ? "Write a caption first"
    : !state.contentType ? "Pick a content type"
    : hasErrors ? "Fix the platform errors above"
    : compliance.imageScanning ? "Waiting for the image compliance scan"
    : state.mode === "schedule" && !state.scheduledFor ? "Pick a schedule time"
    : undefined;

  function toggleCollapsed() {
    setPanelCollapsed((v) => {
      try { localStorage.setItem("composer-accounts-collapsed", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }

  // First-comment with the post link auto-appended when the setting is on.
  function effectiveFirstComment() {
    let fc = state.firstComment.trim();
    if (appSettings?.defaultLinkInFirstComment && state.linkUrl && !fc.includes(state.linkUrl)) {
      fc = fc ? `${fc}\n${state.linkUrl}` : state.linkUrl;
    }
    return fc || null;
  }

  // Per-platform fields, pruned to non-empty values (backend milestone M3
  // persists these; older backends simply ignore the extra keys).
  function platformPayload() {
    const captions = {};
    if (state.customize) {
      for (const [p, v] of Object.entries(state.platformCaptions || {})) {
        if (v?.trim() && selectedPlatforms.includes(p)) captions[p] = v.trim();
      }
    }
    const options = {};
    for (const [p, v] of Object.entries(state.platformOptions || {})) {
      if (v && Object.keys(v).length && selectedPlatforms.includes(p)) options[p] = v;
    }
    return {
      ...(Object.keys(captions).length ? { platformCaptions: captions } : {}),
      ...(Object.keys(options).length ? { platformOptions: options } : {}),
    };
  }

  function basePayload() {
    return {
      body: state.body,
      media: state.media.map((m) => ({ url: m.url, type: m.type })),
      linkUrl: state.linkUrl || null,
      socialAccountIds: state.selectedIds,
      contentType: state.contentType || null,
      templateId: state.templateId || null,
      firstComment: effectiveFirstComment(),
      ...platformPayload(),
    };
  }

  async function submit() {
    if (ctaDisabled) return;
    if (compliance.hasFlags) {
      showToast("This post has compliance flags — posting anyway.", "warn");
    }
    if (state.mode === "schedule") {
      const diff = new Date(state.scheduledFor).getTime() - Date.now();
      if (diff > 30 * 24 * 60 * 60 * 1000) {
        showToast("Scheduling maxes out at 30 days ahead.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      if (state.mode === "now") {
        const result = await apiJson("/api/publish-now", { method: "POST", body: JSON.stringify(basePayload()) });
        const allOk = result.results.every((r) => r.status === "sent");
        showToast(allOk ? "Posted!" : "Some pages failed — check Posts for details.", allOk ? "ok" : "warn");
      } else if (state.mode === "queue" || state.mode === "next") {
        const result = await apiJson("/api/posts", {
          method: "POST",
          body: JSON.stringify({ ...basePayload(), saveAs: "queue" }),
        });
        const when = result.post?.scheduled_for ? new Date(result.post.scheduled_for).toLocaleString() : "the next open slot";
        showToast(result.warning ? `Queued for ${when} (${result.warning})` : `Queued for ${when}.`, result.warning ? "warn" : "ok");
      } else {
        const result = await apiJson("/api/posts", {
          method: "POST",
          body: JSON.stringify({
            ...basePayload(),
            scheduledFor: state.scheduledFor ? new Date(state.scheduledFor).toISOString() : null,
          }),
        });
        const base = result.publishedNow ? "Posted now!" : "Scheduled!";
        showToast(result.warning ? `${base} (${result.warning})` : base, result.warning ? "warn" : "ok");
      }
      invalidatePosts();
      onDone();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraftOrReview(kind) {
    if (!state.selectedIds.length) { showToast("Select at least one account.", "error"); return; }
    if (!state.body.trim()) { showToast("Write a caption first.", "error"); return; }
    setSaving(true);
    try {
      await apiJson("/api/posts", { method: "POST", body: JSON.stringify({ ...basePayload(), saveAs: kind }) });
      showToast(kind === "review" ? "Submitted for review." : "Draft saved.");
      invalidatePosts();
      onDone();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`mx-auto grid max-w-[1400px] gap-4 ${panelCollapsed ? "xl:grid-cols-[56px_1fr_360px]" : "xl:grid-cols-[280px_1fr_360px]"} lg:grid-cols-[260px_1fr]`}>

      {/* LEFT: account selection */}
      <AccountPanel
        accounts={accounts}
        selectedIds={state.selectedIds}
        onChange={(ids) => update({ selectedIds: ids })}
        onNavigate={onNavigate}
        collapsed={panelCollapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* CENTER: content space */}
      <div className="space-y-4">
        {accounts.length === 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No accounts connected</p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
                Go to <button onClick={() => onNavigate("accounts")} className="underline font-medium">Accounts</button> and connect your pages first.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-4">
          <CaptionEditor
            state={state}
            update={update}
            selectedPlatforms={selectedPlatforms}
            defaultHashtags={appSettings?.defaultHashtags}
          />

          {/* Content type — feeds the team's per-associate post-count dashboard */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
            <Tag size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
            <select value={state.contentType} onChange={(e) => update({ contentType: e.target.value })}
              className="flex-1 bg-transparent text-sm outline-none">
              <option value="">Content type (required to publish)</option>
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
                value={state.templateId}
                onChange={(e) => {
                  const id = e.target.value;
                  const t = templates.find((x) => x.id === id);
                  update({
                    templateId: id,
                    ...(t ? { body: state.body ? `${state.body}\n\n${t.content || ""}` : t.content || "" } : {}),
                  });
                }}
                className="flex-1 bg-transparent text-sm outline-none"
              >
                <option value="">Apply a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" onClick={() => onNavigate("templates")} className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Manage
              </button>
            </div>
          )}

          {/* Link URL */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
            <ExternalLink size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
            <input
              type="url"
              value={state.linkUrl}
              onChange={(e) => update({ linkUrl: e.target.value })}
              placeholder="Add a link — appears in caption (optional)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
            />
            {state.linkUrl && (
              <button type="button" onClick={() => update({ linkUrl: "" })} className="text-slate-400 dark:text-gray-500 hover:text-red-500">
                <X size={14} />
              </button>
            )}
          </div>

          {/* First comment */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-800 px-3 py-2.5">
            <MessageSquare size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
            <input
              type="text"
              value={state.firstComment}
              onChange={(e) => update({ firstComment: e.target.value })}
              placeholder="First comment / LIC (optional, posted right after publish)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-gray-500"
            />
            {state.firstComment && (
              <button type="button" onClick={() => update({ firstComment: "" })} className="text-slate-400 dark:text-gray-500 hover:text-red-500">
                <X size={14} />
              </button>
            )}
          </div>

          <MediaPanel
            media={state.media}
            onChange={(updater) => update({ media: typeof updater === "function" ? updater(state.media) : updater })}
            meId={me?.id}
          />

          <PlatformOptionsPanel
            selectedPlatforms={selectedPlatforms}
            options={state.platformOptions}
            onChange={(options) => update({ platformOptions: options })}
            captionFirstLine={state.body.split("\n")[0] || ""}
          />

          <ValidationPanel errorsByPlatform={errorsByPlatform} />
          <CompliancePanel compliance={compliance} hasContent={!!(state.body.trim() || state.media.length)} />

          <ScheduleActions
            mode={state.mode}
            onModeChange={(mode) => update({ mode })}
            scheduledFor={state.scheduledFor}
            onScheduledForChange={(v) => update({ scheduledFor: v })}
            onSubmit={submit}
            onSaveDraft={() => saveDraftOrReview("draft")}
            onSubmitReview={() => saveDraftOrReview("review")}
            onNavigate={onNavigate}
            saving={saving}
            ctaDisabled={ctaDisabled}
            ctaDisabledReason={ctaDisabledReason}
          />
        </div>
      </div>

      {/* RIGHT: live preview */}
      <div className="hidden lg:block xl:col-start-3">
        <PreviewPane
          selectedPlatforms={selectedPlatforms}
          effectiveCaption={effectiveCaption}
          accountFor={accountFor}
          state={state}
        />
      </div>
    </div>
  );
}
