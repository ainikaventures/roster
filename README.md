# Roster

> All-in-one operations, communications, and HR platform for deskless and frontline teams.

Roster is a unified web platform (with PWA support) that lets businesses manage their entire deskless workforce — scheduling shifts, tracking time, communicating with the team, assigning tasks, onboarding new hires, and running HR workflows — without needing five separate tools.

**Status:** Phase 8 — Enterprise shipped: dependency-free TOTP 2FA with backup codes, IPv4 CIDR allowlist enforced server-side, SAML 2.0 SSO config + SCIM v2 provisioning endpoint, a kudos / points system with leaderboard, a greedy auto-scheduler that respects availability windows, and a field-dispatch Jobs surface. Roster has now shipped all eight phases from the [product spec](info/PRODUCT_SPEC.md).

## Architecture

Roster is built around a three-level org hierarchy:

```
Organization
   └── Branch         (e.g., "Downtown Store", "Airport Location")
         └── Team     (e.g., "Kitchen", "Front of House")
               └── Employees
```

Every record (shifts, chats, tasks, forms) is scoped to a team, branch, or org. Managers can span multiple teams or branches; employees belong to exactly one team.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix |
| State | TanStack Query + Zustand |
| Auth | Auth.js (NextAuth) — email + Google |
| Database | PostgreSQL + Prisma |
| Realtime | Socket.IO (Phase 2+) |
| File storage | S3 (Phase 4+) |
| Background jobs | BullMQ + Redis (Phase 2+) |
| Error tracking | Sentry |
| Analytics | PostHog |
| Deployment | Vercel + Railway |
| CI/CD | GitHub Actions |
| PWA | next-pwa + Workbox |

## Repo layout

```
/apps
  /web              Next.js app (admin + employee UI)
/packages
  /db               Prisma schema + client
  /ui               Shared shadcn/Radix component library
  /types            Shared TypeScript types
  /config           Shared eslint / tsconfig presets
/info               Product spec and reference docs
```

Managed with [Turborepo](https://turbo.build).

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+ (local or hosted — Railway, Supabase, Neon all work)

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` at the repo root and fill in:

```bash
cp .env.example .env
```

Required for the app to boot:

- `DATABASE_URL` — Postgres connection string
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` in dev

Optional but recommended:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for Google sign-in
- `EMAIL_SERVER` / `EMAIL_FROM` — for magic-link email auth
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` — error tracking
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — analytics
- `DEMO_MODE=true` — exposes `/demo-login` with one-click sign-in for the
  seeded Acme Hospitality users. Leave **unset in production**.

## Deploying to Vercel

The repo is configured for a Vercel monorepo deploy with **Root Directory =
`apps/web`**.

1. Provision a Postgres database (Vercel Postgres, Neon, Supabase, etc.) and
   note the connection string.
2. In the Vercel dashboard, import the repo and set Root Directory to
   `apps/web`. Vercel reads `apps/web/vercel.json` for the install + build
   commands (these install the root workspace, run `prisma generate` and
   `prisma migrate deploy`, then build Next).
3. Add the env vars listed above to the project. For a public demo, set
   `DEMO_MODE=true` so `/demo-login` is available.
4. Deploy. The first build runs Prisma migrations against the configured
   Postgres automatically.

### Database

```bash
npm run db:generate      # generate Prisma client
npm run db:migrate       # apply migrations to your DB
npm run db:seed          # (optional) seed a demo org
```

### Run

```bash
npm run dev
```

The web app is at <http://localhost:3000>.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start all apps in dev mode |
| `npm run build` | Build all apps and packages |
| `npm run lint` | Lint everything |
| `npm run typecheck` | Typecheck everything |
| `npm run test` | Run unit tests |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run format` | Prettier across the repo |

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal, research, educational, and other noncommercial use. Commercial use requires a separate license; contact the maintainers.

## Contributing

This is an early-stage project; contributions and feedback are welcome via issues and PRs. Please read the [product spec](info/PRODUCT_SPEC.md) first so suggestions land in the right phase.
