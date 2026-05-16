import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@roster/ui';
import { getServerAuthSession } from '@/lib/auth';

export default async function LandingPage() {
  const session = await getServerAuthSession();

  // Already signed in → go straight to the app shell, which decides org/onboarding.
  if (session?.user) {
    redirect('/app');
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Roster
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="container flex flex-1 flex-col items-start justify-center gap-6 py-16 md:py-24">
        <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Phase 0 · Foundations
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          One platform for your deskless team. Not five.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Schedule shifts, track time, talk to your team, run onboarding — across every
          branch and team, on web or mobile.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Create your workspace</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Roster</span>
          <span>PolyForm Noncommercial 1.0.0</span>
        </div>
      </footer>
    </main>
  );
}
