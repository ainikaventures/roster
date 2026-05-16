import Link from 'next/link';
import { Button } from '@roster/ui';

const MESSAGES: Record<string, string> = {
  Configuration: 'The server is missing an auth provider configuration. Check your env vars.',
  AccessDenied: 'You don’t have access to this workspace.',
  Verification: 'That sign-in link is invalid or has expired. Request a new one.',
  Default: 'We hit a snag signing you in. Try again in a moment.',
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const code = searchParams.error ?? 'Default';
  const message = MESSAGES[code] ?? MESSAGES.Default;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Sign-in failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/login">Try again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
