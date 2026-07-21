import Link from "next/link";

// Shared shell for the public legal pages (/privacy, /terms, /data-deletion).
// These must stay outside the auth gate — Meta's app review fetches them
// anonymously, so middleware.js deliberately doesn't match these routes.
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-gray-950">
      <header className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">ES</div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">Posting Pilot</span>
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-500 dark:text-gray-400">
            <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400">Terms</Link>
            <Link href="/data-deletion" className="hover:text-indigo-600 dark:hover:text-indigo-400">Data Deletion</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">Last updated: {updated}</p>

        <div className="mt-8 space-y-6 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm
                        text-[15px] leading-relaxed text-slate-700 dark:text-gray-300
                        [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-white
                        [&_h2:first-child]:mt-0
                        [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
                        [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400
                        [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-gray-600">
          © {new Date().getFullYear()} EssentiallySports. All rights reserved.
        </p>
      </main>
    </div>
  );
}
