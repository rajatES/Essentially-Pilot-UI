import LegalPage from "@/components/legal/LegalPage";

export const metadata = {
  title: "Data Deletion Instructions — ES Posting Pilot",
  description: "How to delete your data, including data obtained from Meta, from ES Posting Pilot."
};

const CONTACT = "privacy@essentiallysports.com";

export default function DataDeletion() {
  return (
    <LegalPage title="Data Deletion Instructions" updated="21 July 2026">
      <p>
        ES Posting Pilot stores data about the social accounts you connect and the posts you create.
        This page explains how to delete that data. It covers data obtained from Meta (Facebook,
        Instagram, Threads) as well as from Google/YouTube and X.
      </p>

      <h2>Option 1 — Disconnect a single account (immediate, self-service)</h2>
      <p>To remove one connected account and its stored credentials:</p>
      <ul>
        <li>Sign in to ES Posting Pilot.</li>
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
        <li>Locate <strong>ES Posting Pilot</strong> in the list.</li>
        <li>Choose <strong>Remove</strong>.</li>
      </ul>
      <p>
        This invalidates the tokens we hold for that account. To also erase the associated records
        from our database, follow Option 3.
      </p>

      <h2>Option 3 — Delete all of your data (full erasure)</h2>
      <p>
        Email <a href={`mailto:${CONTACT}?subject=Data%20deletion%20request`}>{CONTACT}</a> from the
        email address associated with your ES Posting Pilot account, with the subject
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
        platforms, not in ES Posting Pilot. Deleting your data here does not remove those posts — you
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
