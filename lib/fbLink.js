// Build a viewable Facebook permalink from the external_post_id returned
// by the Graph API. Page feed posts return "{pageId}_{storyId}".
export function facebookPostUrl(externalPostId) {
  if (!externalPostId) return null;
  if (externalPostId.includes("_")) {
    const [pageId, storyId] = externalPostId.split("_");
    return `https://www.facebook.com/${pageId}/posts/${storyId}`;
  }
  return `https://www.facebook.com/${externalPostId}`;
}
