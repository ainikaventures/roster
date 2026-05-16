import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Edge middleware. We only do a cheap "is there a NextAuth session cookie?"
// check here — full role-based authorization happens server-side in
// requireScope(). Edge handlers can't touch Prisma without bundling pain.
//
// Cookie names: next-auth.session-token (HTTP) or __Secure-next-auth.session-token (HTTPS).
// ---------------------------------------------------------------------------

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function middleware(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Guard the authenticated app surface only. API routes do their own checks.
  matcher: ['/app/:path*'],
};
