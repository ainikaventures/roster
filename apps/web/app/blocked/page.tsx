import Link from 'next/link';
import { Button } from '@roster/ui';

export const metadata = { title: 'Access blocked' };

export default function BlockedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Access blocked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your workspace restricts access to specific networks. Connect from an
          allowed network or ask an admin to add your IP.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
