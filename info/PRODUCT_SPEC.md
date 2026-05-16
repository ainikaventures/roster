# Connecteam Clone — Product Specification

> A unified all-in-one operations, communications, and HR platform for deskless and frontline teams. Web app with PWA support for mobile-friendly access.

---

## 1. Product Overview

### 1.1 Vision
Build a single platform that lets businesses manage their entire deskless workforce — scheduling shifts, tracking time, communicating with the team, assigning tasks, onboarding new hires, and running HR workflows — without needing five separate tools.

### 1.2 Target Users
- **Admins / Owners** — full control over the workspace, all branches, billing, and configuration.
- **Branch Managers** — manage one or more branches; can span multiple teams within those branches.
- **Team Managers / Supervisors** — manage one or more specific teams; schedule, approve, communicate within their scope.
- **Frontline employees** — belong to a single team; clock in/out, view their team's shifts, chat, complete tasks, fill forms.

### 1.3 Org Hierarchy

The platform is built around a three-level hierarchy:

```
Organization
   └── Branch         (e.g., "Downtown Store", "Airport Location")
         └── Team     (e.g., "Kitchen", "Front of House", "Cleaning Crew")
               └── Employees
```

- **Employees** are scoped to **exactly one team** (and therefore one branch and one org).
- **Managers and admins** can be assigned to **multiple teams and/or branches**.
- All data — shifts, chat, tasks, forms — respects this scope. An employee only ever sees their own team's content. A manager sees an aggregated view across every team they manage.

### 1.4 Core Differentiators
- One platform, not five.
- Mobile-first via PWA — no app store friction.
- True multi-branch, multi-team architecture from day one.
- Granular role and permission system that maps to org structure.
- Works offline for time clock and form submissions.

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR, file-based routing, API routes, easy PWA setup, great DX |
| **UI** | Tailwind CSS + shadcn/ui + Radix primitives | Composable, accessible, fast to ship |
| **State** | TanStack Query + Zustand | Server state + light client state |
| **Backend** | Node.js + Express (or Next.js API routes for v1) | Familiar, broad ecosystem |
| **Database** | PostgreSQL + Prisma ORM | Relational integrity, type-safe queries, migrations |
| **Auth** | NextAuth.js / Auth.js + JWT | Email, OAuth, magic links |
| **Realtime** | Socket.IO (or Pusher/Ably as a managed alternative) | Chat, notifications, live updates |
| **File storage** | AWS S3 (or Cloudflare R2) + signed URLs | Avatars, attachments, documents |
| **Background jobs** | BullMQ + Redis | Notifications, reports, recurring tasks |
| **Push notifications** | Web Push API (VAPID) + FCM | PWA push on mobile |
| **Email** | Resend / Postmark | Transactional email |
| **SMS** | Twilio | Shift alerts, 2FA |
| **Search** | Postgres full-text (v1) → Meilisearch (later) | Cost-effective, scales when needed |
| **Analytics** | PostHog (self-hosted optional) | Product analytics + feature flags |
| **Error tracking** | Sentry | Frontend + backend error monitoring |
| **Deployment** | Vercel (frontend) + Railway/Fly.io (backend + DB) | Simple, scalable |
| **CI/CD** | GitHub Actions | Lint, test, deploy on merge |
| **Testing** | Vitest + Playwright | Unit + E2E |
| **PWA** | next-pwa + Workbox | Service worker, offline cache, installable |

### 2.1 Repo Structure (Monorepo Recommended)
```
/apps
  /web        — Next.js app (admin + employee UI)
  /api        — Express API (optional split; can stay in /web for v1)
/packages
  /db         — Prisma schema + client
  /ui         — Shared component library
  /types      — Shared TypeScript types
  /config     — Shared eslint/tsconfig
```
Use **Turborepo** or **Nx** to manage it.

---

## 3. Cross-Cutting Concepts

These apply across every feature and should be designed in from day one.

### 3.1 Multi-Tenancy & Scoping
- Every record scoped to an `organizationId`, and where relevant, `branchId` and `teamId`.
- Query-level enforcement: middleware injects the user's accessible scope (org + branches + teams) into every read.
- Writes validate that target scope is within the user's permission set.
- One user can belong to multiple orgs (workspace switcher).

### 3.2 Roles & Permissions
- **System roles** map to hierarchy:
  - **Owner / Admin** — org-wide access.
  - **Branch Manager** — assigned to one or more branches; sees every team in those branches.
  - **Team Manager** — assigned to one or more teams; sees only those teams.
  - **Employee** — assigned to exactly one team; sees only that team.
- **Manager assignments are explicit** — a manager has an `assignments` list (branch IDs and/or team IDs). Scope = union of those.
- **Custom roles** (later phase): granular permission matrix per feature, still bound to a scope.
- **Smart groups** (later phase): dynamic user groups based on attributes (e.g., "All cashiers in Branch A").

### 3.3 Notifications
- In-app notification center.
- Email, SMS, push (PWA) — per-user preferences.
- Notification templates per event type.

### 3.4 Audit Log
- Every sensitive action (delete, permission change, payroll export) logged.
- Filterable by user, date, action type.

### 3.5 Internationalization
- i18n via `next-intl` from day one (even if shipping English-only at first).
- Time zones per user; org default time zone.
- Currency per org.

### 3.6 Mobile / PWA
- Installable on iOS and Android home screens.
- Offline support for time clock and form drafts (IndexedDB).
- Push notifications via Web Push.

---

## 4. Feature Catalog (Complete)

### 4.1 Operations

**Scheduling & Shifts**
- Every shift belongs to a **team** (and therefore a branch).
- **Calendar views adapt to who's looking:**
  - **Employee**: sees only their own team's calendar — their shifts highlighted, teammates' shifts visible for context.
  - **Team Manager**: sees their team(s) in one unified calendar with team filters and color-coding per team.
  - **Branch Manager**: sees every team in their branch(es), color-coded, with filter toggles per team.
  - **Admin / Owner**: sees the entire org, with cascading filters (branch → team → employee).
- Drag-and-drop weekly/monthly scheduler.
- Shift templates and recurring shifts (per team).
- Open shifts (claim-based) — visible only within the team they belong to.
- Shift swaps and trade requests (with manager approval) — scoped to the same team unless cross-team swaps are explicitly enabled.
- Availability and time-off management.
- Conflict detection (overlap, max hours, qualifications) — checked across all teams a user belongs to (relevant for managers covering shifts).
- Auto-scheduling (later phase, optimization-based).
- Shift cost forecasting per team / per branch / org-wide.
- Publish/unpublish and notify on changes — notifications scoped to the affected team only.

**Time Clock & Timesheets**
- Clock in/out from web or PWA.
- GPS geofencing — restrict clock-in to a location radius.
- Selfie / photo verification on clock-in.
- Break tracking (paid/unpaid).
- Manual time entries with manager approval.
- Overtime rules per region/role.
- Timesheet approval workflow.
- Export to payroll (CSV, QuickBooks, Gusto, ADP).

**Tasks & Checklists**
- Tasks scoped to a team by default; can be assigned across teams by managers with multi-team scope.
- One-off and recurring tasks.
- Assign to user, group, team, or role.
- Due dates, priorities, attachments.
- Sub-tasks and dependencies.
- Photo/signature/text completion requirements.
- Daily checklists (opening/closing routines) — typically per team.

**Forms**
- Drag-and-drop form builder.
- Field types: text, number, photo, signature, GPS, dropdown, date, rating.
- Conditional logic (show field if X = Y).
- Submission scoring (for audits/inspections).
- Auto-routing on submit (notify manager, create task).
- PDF export of submissions.

**Job Scheduling** (later)
- Assign jobs to crews with locations.
- Route optimization for field teams.

### 4.2 Communications

**Team Chat**
- Every channel is scoped to a team, branch, or org.
- Default channels auto-created per team (e.g., `#team-kitchen`).
- 1:1 and group conversations.
- Channels (public within scope, private by invite).
- @mentions, reactions, threads.
- File and image sharing.
- Voice notes.
- Read receipts.
- Message search (scoped to user's accessible channels).
- Admin moderation (delete, mute, archive).

**Updates / Announcements**
- Target by scope: org-wide, branch, team, or custom group.
- Rich media (images, video, links).
- Read confirmation tracking with per-team breakdown for managers.
- Scheduled posts.
- Polls and surveys.
- Comments and reactions.

**Directory**
- Searchable employee directory.
- Profile cards: photo, role, contact, department, location.
- Org chart view.
- Click-to-call / click-to-email.

**Knowledge Base / Wiki**
- Folders and pages with rich text.
- Permissions per folder.
- Version history.
- In-app search.

### 4.3 HR

**Onboarding**
- New hire workflows: documents to read, forms to sign, training to complete.
- Progress tracker per new hire.
- e-Signature on policies and contracts.

**Documents**
- Centralized doc library per employee (contracts, IDs, certifications).
- Expiration tracking (license renewals, etc.) with alerts.
- Access control per folder.

**Training & Courses**
- Course builder: video, text, images, quizzes.
- Completion tracking and certificates.
- Required vs optional courses.
- Quizzes with passing scores.

**Time Off**
- PTO request workflow.
- Accrual rules per role/seniority.
- Approval chain.
- Calendar of approved time off.

**Performance & Rewards** (later)
- Recognition / kudos system with points.
- Reward store (gift cards).
- Performance reviews and 1:1 templates.

### 4.4 Admin, Billing & Integrations

**Workspace Settings**
- Branding (logo, color).
- **Branch management** (create, rename, archive branches; assign locations).
- **Team management** (create teams within branches, assign team manager).
- Job roles and qualifications.
- Custom user fields.

**Billing & Subscription**
- Stripe integration.
- Per-seat or flat-tier pricing.
- Free trial, plan upgrades/downgrades.
- Invoices and receipts.
- Tax handling (Stripe Tax).

**Integrations**
- Payroll: QuickBooks, Gusto, ADP, Xero.
- Calendar: Google Calendar, Outlook.
- SSO: Google, Microsoft, SAML (enterprise).
- Zapier / Make for everything else.
- Public REST API with API keys.
- Webhooks for major events.

**Analytics & Reports**
- Hours worked, overtime, attendance rates.
- Shift coverage, no-shows.
- Task completion rates.
- Form submission summaries.
- Custom report builder.
- Scheduled email reports.

**Security**
- 2FA (TOTP, SMS).
- Session management.
- IP allowlists (enterprise).
- Data export and GDPR deletion.
- SOC 2 readiness (audit log, access reviews).

---

## 5. Phased Roadmap

Each phase ships independently. Don't start the next phase until the previous is stable in production.

---

### **Phase 0 — Foundations** *(2 weeks)*

**Goal:** Project scaffolding and infrastructure ready to build on.

- Monorepo setup (Turborepo).
- Next.js app with TypeScript, Tailwind, shadcn/ui.
- Prisma + Postgres connected; first migration.
- Auth.js with email + Google login.
- **Hierarchical multi-tenant data model**: Organization → Branch → Team → Membership, with Role and ManagerAssignment.
- Org switcher UI, branch/team selector in nav.
- Seed flow on signup: create org, create first branch, create first team, assign owner.
- Base layout: sidebar nav, top bar, mobile bottom nav, scope breadcrumb (Org / Branch / Team).
- Deployed to staging (Vercel + Railway).
- CI/CD with lint/typecheck/test on PR.
- Sentry + PostHog wired up.

**Exit criteria:** A user can sign up, create an org with at least one branch and team, invite a teammate into a specific team, log in, and land in their scoped view.

---

### **Phase 1 — MVP: Schedule + Time Clock** *(4–6 weeks)*

**Goal:** Replace a basic scheduling spreadsheet + paper timesheets.

**Scheduling**
- Weekly schedule view (drag-and-drop on desktop, list view on mobile).
- **Role-based calendar:**
  - Employee sees their team's calendar with own shifts highlighted.
  - Manager sees all teams in their scope in one unified calendar with team color-coding and filter toggles.
  - Admin sees the entire org with branch + team filters.
- Create/edit/delete shifts (scoped to a team).
- Assign to employee (only employees in that team selectable).
- Publish schedule → email + in-app notification to that team only.
- Employee shift list view (own team only).

**Time Clock**
- Clock in / clock out from any device.
- Break start/stop.
- Timesheet view (employee sees own; manager sees team).
- Manual edit with audit trail.
- Weekly timesheet approval by manager.

**Supporting**
- Employee directory (read-only, basic).
- Notification center (in-app only at first).
- Email notifications via Resend.
- PWA installability (manifest + service worker).

**Exit criteria:** A small business (10–50 employees) can run a full week of scheduling and time tracking on the platform.

---

### **Phase 2 — Communications** *(4 weeks)*

**Goal:** Replace WhatsApp groups and email chains.

- Team chat: 1:1, group, channels (Socket.IO).
- File and image attachments.
- @mentions and reactions.
- Updates feed (announcements with read tracking).
- Push notifications via Web Push (VAPID).
- Notification preferences per user.
- Search across chat messages.

**Exit criteria:** A team can move all daily communication off WhatsApp/Slack and into the app.

---

### **Phase 3 — Tasks & Forms** *(4 weeks)*

**Goal:** Replace clipboards and paper checklists.

- Task assignment (user / group / role).
- Recurring tasks (daily checklists).
- Photo and signature completion requirements.
- Form builder with field types: text, number, photo, signature, GPS, dropdown.
- Conditional logic in forms.
- Form submissions with PDF export.
- Offline form drafting (PWA, IndexedDB).

**Exit criteria:** A frontline worker can complete their entire daily routine — open the app, check tasks, fill the closing form, submit it — without paper.

---

### **Phase 4 — HR Essentials** *(5 weeks)*

**Goal:** Onboard new hires and manage documents in-platform.

- Onboarding workflows (multi-step, per-role templates).
- e-Signature for policies.
- Employee document storage (S3 + signed URLs).
- Document expiration tracking with alerts.
- Time-off requests with approval workflow.
- PTO accrual rules.
- Time-off calendar.

**Exit criteria:** A new hire can be onboarded entirely through the platform — no email back-and-forth.

---

### **Phase 5 — Training & Knowledge** *(4 weeks)*

**Goal:** Centralize SOPs, training, and team knowledge.

- Course builder (text, image, video, quiz).
- Required vs optional courses, completion tracking.
- Certificates on completion.
- Knowledge base (folders, pages, rich text editor).
- Permissions per folder.
- In-app search across knowledge base.

**Exit criteria:** A new manager can find every SOP and required training in the app without asking around.

---

### **Phase 6 — Advanced Scheduling & Time** *(4 weeks)*

**Goal:** Power-user features for established customers.

- Shift templates and copy-week.
- Open shifts (claim-based).
- Shift swap requests with approval flow.
- Availability management.
- GPS geofenced clock-in.
- Selfie verification on clock-in.
- Overtime rules per region.
- Payroll export (CSV + QuickBooks API).

**Exit criteria:** A 200-employee operation with complex rules can manage scheduling and payroll prep entirely in-platform.

---

### **Phase 7 — Admin, Billing, Integrations** *(5 weeks)*

**Goal:** Make the product sellable and embeddable in customers' stacks.

- Stripe billing: plans, trials, upgrades, invoices.
- Custom roles and permission matrix.
- Smart groups (dynamic membership).
- Branding (logo, color).
- Public REST API with API key management.
- Webhooks (shift created, timesheet submitted, etc.).
- Google / Outlook calendar sync.
- Zapier integration.
- Audit log UI.
- Custom report builder.

**Exit criteria:** A self-serve customer can sign up, pay, and integrate the platform with their existing tools without contacting support.

---

### **Phase 8 — Enterprise & Polish** *(ongoing)*

**Goal:** Land larger contracts and reach feature parity with Connecteam.

- SSO (SAML, Okta, Azure AD).
- IP allowlists.
- SCIM provisioning.
- 2FA enforcement policies.
- Performance & rewards module.
- Auto-scheduling (optimization-based).
- Job scheduling / dispatch for field teams.
- Native mobile apps (React Native) if PWA hits limits.
- SOC 2 audit.

---

## 6. Data Model — Phase 1 Sketch

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  timezone  String   @default("UTC")
  createdAt DateTime @default(now())
  branches  Branch[]
  members   Membership[]
}

model Branch {
  id      String @id @default(cuid())
  orgId   String
  name    String
  address String?
  org     Organization @relation(fields: [orgId], references: [id])
  teams   Team[]
  @@unique([orgId, name])
}

model Team {
  id       String @id @default(cuid())
  branchId String
  name     String
  color    String?  // hex, used in multi-team calendar color-coding
  branch   Branch @relation(fields: [branchId], references: [id])
  shifts   Shift[]
  members  Membership[]
  @@unique([branchId, name])
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  avatarUrl   String?
  memberships Membership[]
  managerAssignments ManagerAssignment[]
}

model Membership {
  id     String @id @default(cuid())
  userId String
  orgId  String
  teamId String?           // required for EMPLOYEE; null/optional for ADMIN/OWNER
  role   Role   @default(EMPLOYEE)
  user   User         @relation(fields: [userId], references: [id])
  org    Organization @relation(fields: [orgId], references: [id])
  team   Team?        @relation(fields: [teamId], references: [id])
  @@unique([userId, orgId])
}

// Managers can span multiple branches and/or teams.
// Employees do NOT use this table — their single team comes from Membership.teamId.
model ManagerAssignment {
  id       String  @id @default(cuid())
  userId   String
  branchId String?
  teamId   String?
  user     User    @relation(fields: [userId], references: [id])
  @@index([userId])
}

enum Role {
  OWNER
  ADMIN
  BRANCH_MANAGER
  TEAM_MANAGER
  EMPLOYEE
}

model Shift {
  id        String   @id @default(cuid())
  teamId    String          // every shift belongs to a team
  userId    String?
  startsAt  DateTime
  endsAt    DateTime
  notes     String?
  published Boolean  @default(false)
  team      Team @relation(fields: [teamId], references: [id])
  @@index([teamId, startsAt])
}

model TimeEntry {
  id         String    @id @default(cuid())
  teamId     String
  userId     String
  clockedIn  DateTime
  clockedOut DateTime?
  breaks     Break[]
  approved   Boolean   @default(false)
  @@index([teamId, userId, clockedIn])
}

model Break {
  id          String    @id @default(cuid())
  timeEntryId String
  startedAt   DateTime
  endedAt     DateTime?
  paid        Boolean   @default(false)
}
```

**Scope resolution rule** (applied as middleware on every query):
- `EMPLOYEE` → `teamId IN (membership.teamId)`
- `TEAM_MANAGER` → `teamId IN (managerAssignment.teamIds)`
- `BRANCH_MANAGER` → `teamId IN (teams where branchId IN managerAssignment.branchIds)`
- `ADMIN` / `OWNER` → `orgId = current org` (no team filter)

Schema expands each phase. Use Prisma migrations for every change.

---

## 7. Non-Functional Requirements

- **Performance**: TTFB < 500ms on dashboard, list views virtualized over 100 items.
- **Availability**: 99.5% uptime in v1, 99.9% by Phase 7.
- **Security**: Passwords hashed with argon2; HTTPS-only; OWASP Top 10 reviewed each phase.
- **Privacy**: GDPR-compliant data export and deletion by Phase 7.
- **Accessibility**: WCAG 2.1 AA on all user-facing screens.
- **Browser support**: Last 2 versions of Chrome, Safari, Firefox, Edge.

---

## 8. Open Questions

These should be answered before Phase 1 starts:

1. Pricing model — per seat, per active user, or flat tier?
2. Free tier — yes/no? If yes, what's the limit (users, features)?
3. Hosting region — US, EU, or both from day one? (affects compliance scope)
4. Primary language and second language priority?
5. Is there a specific vertical (retail, hospitality, construction) we optimize for first?

---

## 9. Definition of Done (per phase)

A phase is "done" only when:

- All features in scope are shipped to production.
- Each feature has unit tests for core logic and at least one E2E happy-path test.
- Docs updated (user-facing help articles + internal architecture notes).
- Analytics events instrumented for the new features.
- Monitoring and alerts in place (Sentry, uptime checks).
- A real pilot user or internal dogfooding session has been completed without blocking bugs.

---

*Last updated: 2026-05-16 (v2 — added Org → Branch → Team hierarchy and scoped multi-team calendar)*
