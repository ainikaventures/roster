import { redirect } from 'next/navigation';
import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { CourseBuilder } from '@/components/training/course-builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New course' };

export default async function NewCoursePage() {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/training');
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CourseBuilder
        teams={scopeData.teams}
        canMakeRequired={ctx.scope.role === 'OWNER' || ctx.scope.role === 'ADMIN'}
      />
    </div>
  );
}
