import LegalPage from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacy Policy — ES Posting Pilot",
  description: "How ES Posting Pilot collects, uses, stores, and deletes data, including data obtained from Meta, Google, and X platforms."
};

const COMPANY = "EssentiallySports";
const CONTACT = "privacy@essentiallysports.com";

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="21 July 2026">
      <p>
        ES Posting Pilot (&ldquo;the Service&rdquo;) is an internal social media scheduling and publishing
        tool operated by {COMPANY}. This policy explains what data the Service collects, why, how long
        it is kept, and how to have it deleted.
      </p>

      <h2>1. Who can use the Service</h2>
      <p>
        The Service is provided for use by {COMPANY} staff and authorised collaborators. Accounts are
        created and approved by an administrator; the Service is not offered to the general public.
      </p>

      <h2>2. Information we collect</h2>
      <p><strong>Account information.</strong> Your name, email address, role, and team/division, used to sign you in and attribute the posts you create.</p>
      <p><strong>Connected social accounts.</strong> When you connect a Facebook Page, Instagram account, Threads profile, X account, or YouTube channel, we store:</p>
      <ul>
        <li>the account/page identifier, display name, and profile picture URL;</li>
        <li>the access token (and refresh token where applicable) issued by that platform;</li>
        <li>which of your connected accounts granted access, so accounts can be managed separately.</li>
      </ul>
      <p><strong>Content you create.</strong> Post text, links, uploaded images and videos, scheduling times, drafts, templates, first comments, and approval history.</p>
      <p><strong>Publishing and performance data.</strong> The identifiers of posts published through the Service, their status, and engagement metrics retrieved from the platforms (such as likes, comments, shares, reach, impressions, and views).</p>
      <p><strong>Activity logs.</strong> A record of actions taken in the Service (for example a post being scheduled, published, or failing) for troubleshooting and team visibility.</p>
      <p>We do <strong>not</strong> collect payment information, and we do not use tracking cookies or third-party advertising trackers.</p>

      <h2>3. Platform data and how we use it</h2>
      <p>
        Data obtained from Meta (Facebook, Instagram, Threads), Google (YouTube), and X is used
        <strong> solely to provide the features you invoke</strong> — publishing and scheduling content
        to accounts you have connected, posting a first comment, detecting whether a published post
        still exists, and displaying its performance metrics back to you.
      </p>
      <p>We do not sell platform data, use it for advertising or profiling, transfer it to data brokers, or use it to build user profiles. Access tokens are used only to make API calls on your behalf and are never shared with third parties.</p>

      <h2>4. Storage and security</h2>
      <p>
        Data is stored in a private Supabase project (PostgreSQL and object storage) hosted on
        infrastructure operated by Supabase and its cloud providers. Access is restricted to
        authorised {COMPANY} personnel. Traffic is encrypted in transit (HTTPS/TLS), and access
        tokens are stored in a database that is not publicly accessible.
      </p>

      <h2>5. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>the social platforms you connect, in order to publish your content and read back its status and metrics;</li>
        <li>our infrastructure providers (Supabase for database, storage, and authentication; our application hosting provider);</li>
        <li>Anthropic, if you use the optional AI caption assistant — in that case the caption text you submit is sent for processing;</li>
        <li>authorities, where required by law.</li>
      </ul>

      <h2>6. Retention</h2>
      <ul>
        <li><strong>Access tokens</strong> are kept until you disconnect the account, the token expires, or the account is deleted.</li>
        <li><strong>Posts, media, and metrics</strong> are kept while your account is active, for record-keeping and reporting.</li>
        <li><strong>Activity logs</strong> are kept for operational troubleshooting.</li>
      </ul>
      <p>Disconnecting an account immediately removes its stored tokens from the Service.</p>

      <h2>7. Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your data at any time. See our{" "}
        <a href="/data-deletion">Data Deletion Instructions</a> for how to request deletion, or contact
        us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Depending on your location you may also have
        the right to object to processing or to lodge a complaint with a supervisory authority.
      </p>

      <h2>8. Children</h2>
      <p>The Service is a workplace tool and is not directed at, or intended for use by, anyone under 18.</p>

      <h2>9. Changes</h2>
      <p>If this policy changes materially we will update the date above and notify users within the Service.</p>

      <h2>10. Contact</h2>
      <p>
        Questions about this policy or your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </LegalPage>
  );
}
