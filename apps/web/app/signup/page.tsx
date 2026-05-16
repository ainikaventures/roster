import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getServerAuthSession } from '@/lib/auth';

export const metadata = { title: 'Sign up' };

export default async function SignupPage() {
  const session = await getServerAuthSession();
  if (session?.user) redirect('/signup/welcome');

  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const emailEnabled = !!process.env.EMAIL_SERVER && !!process.env.EMAIL_FROM;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up to start scheduling your team. We&apos;ll set up your org on the next
          step.
        </p>

        <div className="mt-6">
          <LoginForm googleEnabled={googleEnabled} emailEnabled={emailEnabled} />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
