import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export async function Header() {
  const session = await getSession();
  const isLoggedIn = session.isLoggedIn ?? false;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex h-14 items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold shrink-0">
          StreamTube
        </Link>
        <form action="/search" method="GET" className="flex-1 max-w-md mx-auto">
          <input
            name="q"
            type="search"
            placeholder="Search videos..."
            className="w-full rounded-full border px-4 py-1.5 text-sm bg-muted"
          />
        </form>
        <nav className="flex items-center gap-3 shrink-0">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="text-sm hover:text-primary">
                Dashboard
              </Link>
              <Link href="/subscriptions" className="text-sm hover:text-primary">
                Subscriptions
              </Link>
            </>
          ) : (
            <Link href="/login" className="text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-full">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}