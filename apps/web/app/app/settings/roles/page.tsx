import { redirect } from 'next/navigation';
import { requireScope } from '@/lib/scope';
import { CustomRolesView } from '@/components/settings/custom-roles-view';
import { PERMISSION_GROUPS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Custom roles' };

export default async function RolesPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Custom roles</h1>
        <p className="text-sm text-muted-foreground">
          Define permission sets beyond the built-in Owner / Admin / Manager / Employee
          presets, then assign them to teammates.
        </p>
      </header>
      <CustomRolesView permissionGroups={PERMISSION_GROUPS} />
    </div>
  );
}
