import { requireScope } from '@/lib/scope';
import { KudosView } from '@/components/kudos/kudos-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kudos' };

export default async function KudosPage() {
  await requireScope();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Kudos</h1>
        <p className="text-sm text-muted-foreground">
          Send a teammate recognition. Points show on the leaderboard.
        </p>
      </header>
      <KudosView />
    </div>
  );
}
