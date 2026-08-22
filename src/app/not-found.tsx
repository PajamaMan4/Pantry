import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { NotFoundPath } from "./not-found-path";

// Renders for our own notFound() calls *and* for unmatched URLs.
//
// Deliberately does not log: Next.js renders this boundary into the RSC payload
// of *successful* responses too, so anything logged here fires on HTTP 200 and
// is worse than useless for diagnosis. The reason lines come from the helpers in
// src/lib/not-found.ts, which only run on a genuine miss.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t find anything at this address.
      </p>
      <NotFoundPath />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={buttonVariants({ variant: "default", size: "sm" })}>
          Go home
        </Link>
        <Link href="/recipes" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Browse recipes
        </Link>
        <Link href="/ingredients" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Browse ingredients
        </Link>
      </div>
    </div>
  );
}
