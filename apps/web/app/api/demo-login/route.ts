import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@roster/db';
import { DEMO_USERS, ensureDemoData, isDemoMode } from '@/lib/demo';

// ---------------------------------------------------------------------------
// GET /api/demo-login?as=<email>
//
// Mints a real NextAuth-compatible Session row for one of the seeded demo
// users and sets the `next-auth.session-token` cookie. From there, every
// downstream API and page sees a normal signed-in user.
//
// Only available when DEMO_MODE=true. In production (DEMO_MODE unset), this
// endpoint returns 404 — same as if it didn't exist.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ALLOWED_EMAILS = new Set(DEMO_USERS.map((u) => u.email));
const SESSION_DAYS = 30;

export async function GET(req: Request) {
  if (!isDemoMode()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('as');
  if (!email || !ALLOWED_EMAILS.has(email)) {
    return new NextResponse('Unknown demo user', { status: 400 });
  }

  // Lazy-seed on first hit so a fresh deploy works without a separate step.
  await ensureDemoData();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return new NextResponse('Demo user missing (seed failed)', { status: 500 });
  }

  const sessionToken = randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  // Match NextAuth's default cookie shape (insecure name on HTTP, prefixed on HTTPS).
  const secure = url.protocol === 'https:';
  const cookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

  const callbackUrl = url.searchParams.get('callbackUrl') ?? '/app';
  const response = NextResponse.redirect(new URL(callbackUrl, url));
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return response;
}
