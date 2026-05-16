# Roster

> All-in-one operations, communications, and HR platform for deskless and frontline teams.

Roster is a unified web platform (with PWA support) that lets businesses manage their entire deskless workforce — scheduling shifts, tracking time, communicating with the team, assigning tasks, onboarding new hires, and running HR workflows — without needing five separate tools.

**Status:** Phase 7 — Admin, Billing, Integrations shipped: a public REST API under `/api/v1` with hashed Bearer API keys, signed outbound webhooks (HMAC-SHA256), an audit-log UI, custom roles + permission matrix, branding (logo + brand color applied across the app), and a Stripe-ready billing schema with plan switching. Builds on Phase 0–6. See [info/PRODUCT_SPEC.md](info/PRODUCT_SPEC.md) for the full roadmap.

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
