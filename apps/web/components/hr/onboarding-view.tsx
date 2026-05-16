'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus, UserPlus } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@roster/ui';
import type { OnboardingStep, CompletedSteps } from '@/lib/onboarding';
import { NewOnboardingTemplateDialog } from './new-onboarding-template-dialog';
import { AssignOnboardingDialog } from './assign-onboarding-dialog';

type Template = {
  id: string;
  title: string;
  description: string | null;
  steps: { steps: OnboardingStep[] };
  updatedAt: string;
  _count: { assignments: number };
};

type Assignment = {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  completedSteps: CompletedSteps;
  startedAt: string;
  completedAt: string | null;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  template: { id: string; title: string; description: string | null; steps: { steps: OnboardingStep[] } };
};

export function OnboardingView({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [creatingTemplate, setCreatingTemplate] = React.useState(false);
  const [assigning, setAssigning] = React.useState<Template | null>(null);

  const templates = useQuery({
    queryKey: ['onboarding-templates'],
    queryFn: async (): Promise<Template[]> => {
      const res = await fetch('/api/onboarding/templates');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    enabled: canManage,
  });

  const assignments = useQuery({
    queryKey: ['onboarding-assignments'],
    queryFn: async (): Promise<Assignment[]> => {
      const res = await fetch('/api/onboarding/assignments');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const markStep = useMutation({
    mutationFn: async ({ id, stepId }: { id: string; stepId: string }) => {
      const res = await fetch(`/api/onboarding/assignments/${id}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-assignments'] }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Multi-step workflows for new hires. Each step ties to a doc, form,
            task, or video.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreatingTemplate(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
          </Button>
        )}
      </header>

      {/* Templates (managers only) */}
      {canManage && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Templates</h2>
          <Card>
            <CardContent className="p-0">
              {(templates.data ?? []).length === 0 && !templates.isLoading && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No templates yet. Create one to start onboarding new hires.
                </p>
              )}
              <ul className="divide-y">
                {(templates.data ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.steps.steps.length} steps
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t._count.assignments} assignment
                        {t._count.assignments === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setAssigning(t)}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Assign
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Assignments */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {canManage ? 'Active assignments' : 'Your onboarding'}
        </h2>
        {(assignments.data ?? []).length === 0 && !assignments.isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No active onboarding.
            </CardContent>
          </Card>
        )}
        {(assignments.data ?? []).map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onComplete={(stepId) => markStep.mutate({ id: a.id, stepId })}
          />
        ))}
      </section>

      {creatingTemplate && (
        <NewOnboardingTemplateDialog
          open
          onOpenChange={(o) => setCreatingTemplate(o)}
          onCreated={() => {
            setCreatingTemplate(false);
            qc.invalidateQueries({ queryKey: ['onboarding-templates'] });
          }}
        />
      )}

      {assigning && (
        <AssignOnboardingDialog
          open
          template={assigning}
          onOpenChange={(o) => !o && setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            qc.invalidateQueries({ queryKey: ['onboarding-assignments'] });
          }}
        />
      )}
    </>
  );
}

function AssignmentCard({
  assignment,
  onComplete,
}: {
  assignment: Assignment;
  onComplete: (stepId: string) => void;
}) {
  const steps = assignment.template.steps.steps;
  const done = Object.keys(assignment.completedSteps).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const initials =
    assignment.user.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('') ?? assignment.user.email[0]?.toUpperCase() ?? '?';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-base">
                {assignment.user.name ?? assignment.user.email}
              </CardTitle>
              <CardDescription className="text-xs">
                {assignment.template.title} · {done}/{total} steps · {pct}%
              </CardDescription>
            </div>
          </div>
          {assignment.status === 'COMPLETED' && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Complete
            </Badge>
          )}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const completed = !!assignment.completedSteps[step.id];
            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2',
                  completed && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium',
                    completed
                      ? 'border-emerald-500 bg-emerald-500 text-emerald-50'
                      : 'border-muted-foreground/30 text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {completed ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        completed && 'text-muted-foreground line-through',
                      )}
                    >
                      {step.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {stepLabel(step.kind)}
                    </Badge>
                  </div>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                  {step.kind === 'video' && 'url' in step && (
                    <a
                      href={(step as { url: string }).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Watch ↗
                    </a>
                  )}
                </div>
                {!completed && (
                  <button
                    type="button"
                    onClick={() => onComplete(step.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mark done
                    <ChevronRight className="ml-1 inline h-3 w-3" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function stepLabel(kind: OnboardingStep['kind']): string {
  switch (kind) {
    case 'text':
      return 'read';
    case 'video':
      return 'video';
    case 'read_doc':
      return 'document';
    case 'sign_doc':
      return 'sign';
    case 'form':
      return 'form';
    case 'task':
      return 'task';
  }
}
