import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="font-display mt-3 text-2xl font-bold text-ink">This page doesn&rsquo;t exist</h1>
      <p className="mt-3 text-muted">It may have been removed, or the link is wrong.</p>
      <Link href="/start" className="btn btn-primary mt-8">
        Go home
      </Link>
    </main>
  );
}
