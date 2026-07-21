// Client-side Google Drive picker. Each user signs into THEIR OWN Google
// account via a popup (Google Identity Services token flow), picks an image
// with the Google Picker, and we download it with their short-lived token.
// Nothing is stored server-side — fully scalable across teammates.
//
// Requires two public env vars (see README-integrations.md):
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  — OAuth 2.0 Web client ID
//   NEXT_PUBLIC_GOOGLE_API_KEY    — API key with the Picker API enabled

let scriptsPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureGoogleScripts() {
  if (!scriptsPromise) {
    scriptsPromise = Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js")
    ]).then(() => new Promise((resolve) => window.gapi.load("picker", resolve)));
  }
  return scriptsPromise;
}

// Opens Google sign-in, then the Drive picker. Resolves to a File (ready for
// the existing /api/upload flow) or null if the user cancels.
export async function pickImageFromGoogleDrive({ clientId, apiKey }) {
  await ensureGoogleScripts();

  const accessToken = await new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (resp) =>
        resp.access_token ? resolve(resp.access_token) : reject(new Error(resp.error || "Google sign-in failed.")),
      error_callback: () => reject(new Error("Google sign-in was cancelled."))
    });
    tokenClient.requestAccessToken();
  });

  const doc = await new Promise((resolve) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES))
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) resolve(data.docs[0]);
        else if (data.action === window.google.picker.Action.CANCEL) resolve(null);
      })
      .build();
    picker.setVisible(true);
  });
  if (!doc) return null;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Couldn't download that file from Google Drive.");
  const blob = await res.blob();
  return new File([blob], doc.name || "drive-image", { type: blob.type || doc.mimeType || "image/jpeg" });
}
