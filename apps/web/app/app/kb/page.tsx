import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { KbBrowser } from '@/components/kb/kb-browser';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Knowledge base' };

export default async function KbPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="text-sm text-muted-foreground">
          SOPs, FAQs, and how-to articles — searchable across the org.
        </p>
      </header>
      <KbBrowser canManage={isManager(ctx.scope.role)} />
    </div>
  );
}
