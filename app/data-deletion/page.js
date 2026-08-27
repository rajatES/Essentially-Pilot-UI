import LegalPage from "@/components/legal/LegalPage";

export const metadata = {
  title: "Data Deletion Instructions — ES Social Post",
  description: "How to delete your data, including data obtained from Meta, from ES Social Post."
};

const CONTACT = "rajat@essentiallysports.com";

// This page doubles as the STATUS page for Meta's data-deletion callback
// (POST /api/meta/data-deletion). Meta's contract requires the callback to
// return a url a human can open to see what happened to their request, so the
// callback points here with ?code=<confirmation_code> and the block below
// renders that outcome. Without this, the url we hand Meta would be a generic
// instructions page that never mentions the request — which is what Meta's
// "human-readable explanation of the status of their request" rules out.
//
// A Server Component receives searchParams, so no client JS is involved.
export default function DataDeletion({ searchParams }) {
  const code = typeof searchParams?.code === "string" ? searchParams.code : null;

  return (
    <LegalPage title="Data Deletion Instructions" updated="27 August 2026">
      {code && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            Your deletion request is complete.
          </p>
          <p className="mt-1.5 text-emerald-800 dark:text-emerald-300">
            Reference code: <strong className="font-mono">{code}</strong>
          </p>
          <p className="mt-2 text-emerald-800 dark:text-emerald-300">
            We received this request from Meta and processed it immediately. Every access token,
            account identifier, display name and profile picture reference we held for the connected
            Instagram or Facebook account has been deleted from our database. Nothing further is
            required from you.
          </p>
          <p className="mt-2 text-emerald-800 dark:text-emerald-300">
            Posts already published to Facebook or Instagram are held by those platforms, not by us,
            so they are unaffected — see <em>What we cannot delete</em> below. If you also want your
            user profile, drafts and uploaded media erased, use Option 3 and quote this reference
            code.
          </p>
        </div>
      )}

      <p>
        ES Social Post stores data about the social accounts you connect and the posts you create.
        This page explains how to delete that data. It covers data obtained from Meta (Facebook,
        Instagram, Threads) as well as from Google/YouTube and X.
      </p>

      <h2>Option 1 — Disconnect a single account (immediate, self-service)</h2>
      <p>To remove one connected account and its stored credentials:</p>
      <ul>
        <li>Sign in to ES Social Post.</li>
        <li>Go to <strong>Accounts</strong>.</li>
        <li>Find the Page, profile, or channel you want to remove and choose <strong>Disconnect</strong>.</li>
      </ul>
      <p>
        This immediately deletes the stored access token, the account&rsquo;s identifier, its display
        name, and its profile picture reference from our systems. Posts already published to that
        platform are not affected — they remain on the platform until you delete them there.
      </p>

      <h2>Option 2 — Revoke access from Facebook</h2>
      <p>You can also revoke the app&rsquo;s access from Facebook directly:</p>
      <ul>
        <li>Go to <strong>Facebook → Settings &amp; Privacy → Settings → Apps and Websites</strong>.</li>
        <li>Locate <strong>ES Social Post</strong> in the list.</li>
        <li>Choose <strong>Remove</strong>.</li>
      </ul>
      <p>
        This invalidates the tokens we hold for that account. To also erase the associated records
        from our database, follow Option 3.
      </p>

      <h2>Option 3 — Delete all of your data (full erasure)</h2>
      <p>
        Email <a href={`mailto:${CONTACT}?subject=Data%20deletion%20request`}>{CONTACT}</a> from the
        email address associated with your ES Social Post account, with the subject
        &ldquo;Data deletion request&rdquo;. Please state whether you want:
      </p>
      <ul>
        <li><strong>Platform data only</strong> — all connected accounts, access tokens, published-post references, and performance metrics; or</li>
        <li><strong>Everything</strong> — the above plus your user profile, drafts, scheduled posts, uploaded media, templates, and activity history.</li>
      </ul>
      <p>
        We will confirm the request, complete the deletion within <strong>30 days</strong>, and email
        you when it is done. We may need to verify your identity before proceeding.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Access tokens and refresh tokens for every connected platform</li>
        <li>Connected account identifiers, display names, and profile picture references</li>
        <li>Scheduled, draft, and published post records created by you, including uploaded images and videos</li>
        <li>Performance metrics retrieved from the platforms</li>
        <li>Your user profile and activity log entries (full erasure only)</li>
      </ul>

      <h2>What we cannot delete</h2>
      <p>
        Content already published to Facebook, Instagram, Threads, X, or YouTube lives on those
        platforms, not in ES Social Post. Deleting your data here does not remove those posts — you
        need to delete them on the platform itself, or use the delete options within the app before
        requesting erasure.
      </p>
      <p>
        We may also retain limited records where required by law, in which case they are retained only
        for as long as legally necessary.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about deletion or the status of a request:{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
