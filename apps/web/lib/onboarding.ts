import { z } from 'zod';

// ---------------------------------------------------------------------------
// Onboarding workflow runtime.
//
// A template's `steps` field is JSON shaped { steps: OnboardingStep[] }.
// Each step is a discriminated union — the renderer at /app/hr/onboarding
// looks up the kind to pick a UI affordance, and the completion API
// validates that the step ID exists and applies any kind-specific
// requirements (e.g. signing the linked document for `sign_doc`).
// ---------------------------------------------------------------------------

const StepBase = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/i).max(40),
  title: z.string().min(1).max(140),
  description: z.string().max(2000).optional(),
});

const TextStep = StepBase.extend({
  kind: z.literal('text'),
});

const VideoStep = StepBase.extend({
  kind: z.literal('video'),
  url: z.string().url(),
});

const ReadDocStep = StepBase.extend({
  kind: z.literal('read_doc'),
  documentId: z.string().min(1),
});

const SignDocStep = StepBase.extend({
  kind: z.literal('sign_doc'),
  documentId: z.string().min(1),
});

const FormStep = StepBase.extend({
  kind: z.literal('form'),
  formId: z.string().min(1),
});

const TaskStep = StepBase.extend({
  kind: z.literal('task'),
  taskId: z.string().min(1),
});

export const OnboardingStep = z.discriminatedUnion('kind', [
  TextStep,
  VideoStep,
  ReadDocStep,
  SignDocStep,
  FormStep,
  TaskStep,
]);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const OnboardingSchema = z.object({
  steps: z.array(OnboardingStep).min(1).max(60),
});
export type OnboardingSchema = z.infer<typeof OnboardingSchema>;

export function validateOnboardingSchema(input: unknown): OnboardingSchema {
  const parsed = OnboardingSchema.parse(input);
  const ids = new Set<string>();
  for (const step of parsed.steps) {
    if (ids.has(step.id)) throw new Error(`Duplicate step id "${step.id}"`);
    ids.add(step.id);
  }
  return parsed;
}

export type CompletedSteps = Record<
  string,
  { completedAt: string; metadata?: Record<string, unknown> }
>;
