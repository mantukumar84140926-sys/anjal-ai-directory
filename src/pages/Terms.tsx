import { SEO } from "@/components/SEO";

export default function Terms() {
  return <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
    <SEO title="Terms of Use — Anjal AI" description="Terms of use for Anjal AI Directory." canonical={`${window.location.origin}/terms`} />
    <article className="rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-10">
      <h1 className="text-3xl font-semibold">Terms of Use</h1>
      <p className="mt-3 text-sm text-slate">Last updated: September 10, 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-slate">
        <section><h2 className="text-lg font-semibold text-inherit">Directory listings</h2><p className="mt-2">Anjal AI is an independent discovery directory. Listings are provided for discovery and may change over time. Commercial details are marked as not verified when reliable pricing data is unavailable.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">Third-party websites</h2><p className="mt-2">Anjal AI does not operate the third-party tools listed in the directory. Use each provider's official website and terms for purchases, accounts, subscriptions and product capabilities.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">Submissions and claims</h2><p className="mt-2">Submitting a tool or claiming a listing does not guarantee publication, verification or approval. We may reject, edit or remove listings to maintain directory quality.</p></section>
        <section><h2 className="text-lg font-semibold text-inherit">Availability</h2><p className="mt-2">The directory is provided on an as-available basis. We do not guarantee that every listed tool, link, price or feature will remain available or accurate at all times.</p></section>
      </div>
    </article>
  </main>;
}
