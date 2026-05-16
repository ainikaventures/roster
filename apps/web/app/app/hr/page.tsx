import Link from 'next/link';
import { CalendarOff, FileText, GraduationCap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@roster/ui';
import { requireScope } from '@/lib/scope';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'HR' };

const SECTIONS = [
  {
    href: '/app/hr/documents',
    title: 'Documents',
    description: 'Policies, contracts, IDs, and certifications.',
    icon: FileText,
  },
  {
    href: '/app/hr/time-off',
    title: 'Time off',
    description: 'Request and approve PTO. View the team calendar.',
    icon: CalendarOff,
  },
  {
    href: '/app/hr/onboarding',
    title: 'Onboarding',
    description: 'Templates and progress for new hires.',
    icon: GraduationCap,
  },
];

export default async function HrPage() {
  await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">HR</h1>
        <p className="text-sm text-muted-foreground">
          Onboarding, documents, and time off — all scoped to your team.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="hover:bg-accent/40">
                <CardHeader>
                  <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
                  <CardTitle className="mt-2">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
