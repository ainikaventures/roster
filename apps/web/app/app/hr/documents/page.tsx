import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { DocumentsView } from '@/components/hr/documents-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documents' };

export default async function DocumentsPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <DocumentsView canManage={isManager(ctx.scope.role)} />
    </div>
  );
}
