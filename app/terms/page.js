import LegalPage from "@/components/legal/LegalPage";

export const metadata = {
  title: "Terms of Service — ES Posting Pilot",
  description: "Terms governing use of the ES Posting Pilot social media scheduling tool."
};

const COMPANY = "EssentiallySports";
const CONTACT = "privacy@essentiallysports.com";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="21 July 2026">
      <p>
        These terms govern use of ES Posting Pilot (&ldquo;the Service&rdquo;), an internal social media
        scheduling and publishing tool operated by {COMPANY}. By using the Service you agree to them.
      </p>

      <h2>1. Access</h2>
      <p>
        The Service is provided for {COMPANY} staff and authorised collaborators. Accounts are issued
        and approved by an administrator and may be suspended or revoked at any time. You are
        responsible for keeping your login credentials secure and for activity carried out under your account.
      </p>

      <h2>2. Acceptable use</h2>
      <p>You agree that you will not use the Service to:</p>
      <ul>
        <li>publish content you do not have the rights to publish;</li>
        <li>publish unlawful, defamatory, misleading, or infringing content;</li>
        <li>connect social accounts you are not authorised to manage;</li>
        <li>violate the terms or policies of any connected platform (Meta, Google/YouTube, or X);</li>
        <li>attempt to circumvent platform rate limits, access controls, or the Service&rsquo;s own access controls.</li>
      </ul>

      <h2>3. Connected accounts</h2>
      <p>
        You may only connect accounts, Pages, or channels you are authorised to administer. You remain
        responsible for all content published through the Service to those accounts. You may disconnect
        an account at any time, which removes its stored access tokens from the Service.
      </p>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of the content you create. You grant {COMPANY} the limited permission to
        store, process, and transmit that content to the platforms you have selected, for the purpose
        of operating the Service.
      </p>

      <h2>5. Third-party platforms</h2>
      <p>
        The Service publishes to platforms operated by third parties. Their availability, behaviour,
        API limits, and policies are outside our control. Platform changes may delay, alter, or prevent
        publishing, and your use of those platforms remains governed by their own terms.
      </p>

      <h2>6. Availability and no warranty</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo;, without warranties of any kind. We do not guarantee
        uninterrupted availability, that scheduled posts will always publish at the exact time
        requested, or that platform metrics shown are complete or accurate.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {COMPANY} is not liable for any indirect, incidental,
        or consequential damages, or for loss of data, revenue, or goodwill arising from use of the
        Service — including content published in error, published late, or not published.
      </p>

      <h2>8. Changes and termination</h2>
      <p>
        We may modify or discontinue the Service, or these terms, at any time. Continued use after a
        change constitutes acceptance. We may terminate access for breach of these terms.
      </p>

      <h2>9. Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalPage>
  );
}
