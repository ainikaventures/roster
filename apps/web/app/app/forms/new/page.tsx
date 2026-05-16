import { redirect } from 'next/navigation';
import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { FormBuilder } from '@/components/forms/form-builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New form' };

export default async function NewFormPage() {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/forms');
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <FormBuilder teams={scopeData.teams} />
    </div>
  );
}
