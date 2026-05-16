import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@roster/db';
import { getServerSession, type AuthOptions, type DefaultSession } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';

// ---------------------------------------------------------------------------
// Augment next-auth's session type with our app-specific fields.
// ---------------------------------------------------------------------------
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      activeOrgId: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  // We use database sessions, so the JWT module isn't really used,
  // but keep this declaration to satisfy type imports if we toggle later.
  interface JWT {
    activeOrgId?: string | null;
  }
}

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
const emailConfigured =
  !!process.env.EMAIL_SERVER && !!process.env.EMAIL_FROM;

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error: '/login/error',
    newUser: '/signup/welcome',
  },
  providers: [
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(emailConfigured
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER!,
            from: process.env.EMAIL_FROM!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, user }) {
      // Pick the user's most-recent membership as their active org by default.
      // The UI can switch via /api/orgs/active.
      // We pick the most-recently-touched membership as the active org.
      // /api/orgs/active bumps `updatedAt` to make a workspace the active one.
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: { orgId: true },
      });
      session.user.id = user.id;
      session.user.activeOrgId = membership?.orgId ?? null;
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      // First-time sign-in: copy display name + avatar from provider if present.
      if (isNewUser && user.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            name: user.name ?? undefined,
            avatarUrl: user.image ?? undefined,
          },
        });
      }
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
