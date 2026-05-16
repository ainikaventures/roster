import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@roster/ui';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { CoursesList } from '@/components/training/courses-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Training' };

export default async function TrainingPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
          <p className="text-sm text-muted-foreground">
            SOPs, certifications, and required learning for your team.
          </p>
        </div>
        {isManager(ctx.scope.role) && (
          <Button asChild size="sm">
            <Link href="/app/training/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New course
            </Link>
          </Button>
        )}
      </header>
      <CoursesList canManage={isManager(ctx.scope.role)} />
    </div>
  );
}
