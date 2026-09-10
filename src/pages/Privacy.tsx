import { SEO } from "@/components/SEO";

export default function Privacy() {
  return <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
    <SEO title="Privacy Policy — Anjal AI" description="Privacy policy for Anjal AI Directory." canonical={`${window.location.origin}/privacy`} />
    <article className="rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-10">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-3 text-sm text-slate">Last updated: September 10, 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-slate">
        <section><h2 className="text-lg font-semibold text-inherit">What we collect</h2><p className="mt-2">Anjal AI may record basic page views, tool views and outbound tool clicks when analytics is configured. Tool submissions and listing claims may include the contact information you choose to provide.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">How we use information</h2><p className="mt-2">We use submitted information to review directory listings and claims, and aggregate analytics to understand which parts of the directory are useful.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">Third-party services</h2><p className="mt-2">Tool links take you to third-party websites. Their privacy practices are governed by their own policies. Advertising may be provided by Google AdSense after publisher configuration and approval.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">Contact</h2><p className="mt-2">For privacy or listing questions, use the contact method provided by the Anjal AI Directory operator.</p></section>
      </div>
    </article>
  </main>;
}
