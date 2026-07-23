// Per-platform composer validation — the SocialPilot-style contextual error
// list. Evaluated against each SELECTED platform's effective caption + media;
// hard errors disable the publish CTAs until resolved (drafts stay allowed).

export const PLATFORM_LIMITS = {
  facebook:  { caption: 63206 },
  instagram: { caption: 2200, maxHashtags: 30 },
  threads:   { caption: 500, maxMedia: 20 },
  twitter:   { caption: 280 },
  youtube:   { caption: 5000, title: 100 },
};

const VIDEO = (m) => m.type === "video";
const IMAGE = (m) => m.type === "image";

// state: { body, platformCaptions, customize, media[], linkUrl, firstComment,
//          platformOptions } — selectedPlatforms: unique platform list.
// Returns { errorsByPlatform: {platform: [{level:"error"|"warn", msg}]}, hasErrors }
export function validateComposer(state, selectedPlatforms) {
  const errorsByPlatform = {};
  const add = (p, level, msg) => {
    (errorsByPlatform[p] ||= []).push({ level, msg });
  };

  const caption = (p) =>
    (state.customize && state.platformCaptions?.[p]?.trim()) || state.body || "";

  const media = state.media || [];
  const videos = media.filter(VIDEO);
  const images = media.filter(IMAGE);

  for (const p of selectedPlatforms) {
    const text = caption(p);
    const limit = PLATFORM_LIMITS[p]?.caption;
    if (limit && text.length > limit) {
      add(p, "error", `Caption is ${text.length - limit} characters over the ${limit.toLocaleString()} limit.`);
    }

    if (p === "facebook") {
      const format = state.platformOptions?.facebook?.format || "post";
      if (format === "post") {
        if (videos.length && images.length) add(p, "error", "Facebook posts can't mix images and video — remove one type.");
        if (videos.length > 1) add(p, "error", "Facebook posts support a single video.");
        if (images.length > 10) add(p, "error", "Facebook carousels support up to 10 images.");
      } else if (format === "reel") {
        if (videos.length !== 1 || images.length) add(p, "error", "A Facebook Reel needs exactly one video (no images).");
      } else if (format === "story") {
        if (media.length !== 1) add(p, "error", "A Facebook Story needs exactly one image or video.");
        if (text) add(p, "warn", "Captions aren't shown on Facebook Stories — the text will be ignored.");
        if (state.firstComment?.trim()) add(p, "warn", "Stories have no comments — the first comment will be skipped.");
      }
    }

    if (p === "instagram") {
      const format = state.platformOptions?.instagram?.format || "feed";
      if (!media.length) add(p, "error", "Instagram requires an image or video — attach media or deselect Instagram.");
      if (format === "reel" && (videos.length !== 1 || images.length)) {
        add(p, "error", "An Instagram Reel needs exactly one video (no images).");
      }
      if (format === "feed" && media.length > 10) add(p, "error", "Instagram carousels support up to 10 items.");
      const hashtags = (text.match(/#\w+/g) || []).length;
      if (hashtags > (PLATFORM_LIMITS.instagram.maxHashtags || 30)) {
        add(p, "warn", `Instagram allows at most 30 hashtags (you have ${hashtags}).`);
      }
    }

    if (p === "threads" && media.length > (PLATFORM_LIMITS.threads.maxMedia || 20)) {
      add(p, "error", "Threads supports up to 20 media items.");
    }

    if (p === "youtube") {
      if (videos.length !== 1) add(p, "error", "YouTube needs exactly one video — attach one or deselect the channel.");
      if (images.length) add(p, "warn", "Images are ignored on YouTube (only the video uploads).");
      const title = state.platformOptions?.youtube?.title || text.split("\n")[0] || "";
      if (title.length > PLATFORM_LIMITS.youtube.title) {
        add(p, "error", `YouTube titles max out at ${PLATFORM_LIMITS.youtube.title} characters.`);
      }
    }
  }

  const hasErrors = Object.values(errorsByPlatform).some((list) => list.some((e) => e.level === "error"));
  return { errorsByPlatform, hasErrors };
}
