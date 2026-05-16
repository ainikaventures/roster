import Link from 'next/link';
import { Button, Card, CardContent } from '@roster/ui';
import { Plus } from 'lucide-react';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { FormsList } from '@/components/forms/forms-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forms' };

export default async function FormsPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Audits, checklists, and any structured data your team collects on the floor.
          </p>
        </div>
        {isManager(ctx.scope.role) && (
          <Button asChild size="sm">
            <Link href="/app/forms/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New form
            </Link>
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="p-0">
          <FormsList canManage={isManager(ctx.scope.role)} />
        </CardContent>
      </Card>
    </div>
  );
}
