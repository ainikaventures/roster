import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roster/ui';
import { DEMO_USERS, ensureDemoData, isDemoMode } from '@/lib/demo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Demo login' };

export default async function DemoLoginPage() {
  if (!isDemoMode()) notFound();

  // Make sure the seeded org + users exist before the user clicks anything.
  await ensureDemoData();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Roster demo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a role to explore. Every account is sandboxed in the demo
            workspace and resets if you re-seed.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_USERS.map((u) => (
            <Card key={u.email}>
              <CardHeader>
                <CardTitle className="text-base">{u.name}</CardTitle>
                <CardDescription>
                  <span className="font-mono text-xs">{u.role.replaceAll('_', ' ').toLowerCase()}</span>{' '}
                  · {u.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href={`/api/demo-login?as=${encodeURIComponent(u.email)}`}>
                    Sign in as {u.name.split(' ')[0]}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          This page only exists when{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">DEMO_MODE=true</code>.{' '}
          <Link href="/" className="underline-offset-2 hover:underline">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}
