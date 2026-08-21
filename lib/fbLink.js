// Build a viewable permalink for a published post from the external id the
// platform returned — per platform, since each has its own URL scheme.
//
// `permalink` is a URL the backend already stored on the post_target (currently
// postiz-backed targets, where Postiz reports the published post's releaseURL).
// It wins when present: a real URL from the platform beats anything derived
// from an id, and it's the only way Instagram/Threads links exist at all.
export function externalPostUrl(platform, externalPostId, permalink) {
  if (typeof permalink === "string" && /^https?:\/\//i.test(permalink)) return permalink;
  if (!externalPostId || externalPostId.includes("_mock_")) return null;

  switch (platform) {
    case "facebook": {
      // Page feed posts return "{pageId}_{storyId}".
      if (externalPostId.includes("_")) {
        const [pageId, storyId] = externalPostId.split("_");
        return `https://www.facebook.com/${pageId}/posts/${storyId}`;
      }
      return `https://www.facebook.com/${externalPostId}`;
    }
    case "youtube":
      return `https://www.youtube.com/watch?v=${externalPostId}`;
    case "twitter":
      // /i/status resolves without needing the username.
      return `https://x.com/i/status/${externalPostId}`;
    // Instagram and Threads return media IDs that don't map to public URLs
    // without an extra permalink API call — no direct link (yet).
    default:
      return null;
  }
}

// Backwards-compatible alias (old name, Facebook-only behaviour).
export function facebookPostUrl(externalPostId) {
  return externalPostUrl("facebook", externalPostId);
}
