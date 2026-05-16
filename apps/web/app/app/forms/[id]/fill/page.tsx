import { notFound } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { FormRunner } from '@/components/forms/form-runner';

export const dynamic = 'force-dynamic';

export default async function FillFormPage({ params }: { params: { id: string } }) {
  const ctx = await requireScope();

  const form = await prisma.formTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      teamId: true,
      schema: true,
    },
  });

  if (!form) notFound();
  if (
    form.teamId &&
    ctx.scope.teamIds !== null &&
    !ctx.scope.teamIds.includes(form.teamId)
  ) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <FormRunner
        formId={form.id}
        title={form.title}
        description={form.description}
        schema={form.schema as { fields: unknown[] }}
      />
    </div>
  );
}
