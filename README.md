# ScopeGuard

**Change order approval workflow SaaS for agencies.**

ScopeGuard eliminates the friction of getting client sign-off on project scope changes. Agencies create structured change orders, send one-click approval links directly to clients (no client login required), collect e-signatures, and maintain a full compliance audit trail — all in one place.

---

## Table of Contents

1. [What ScopeGuard Does](#what-scopeguard-does)
2. [Feature Overview](#feature-overview)
3. [How to Use the App](#how-to-use-the-app)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Core Utility Libraries](#core-utility-libraries)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Security Model](#security-model)
10. [Running Locally](#running-locally)
11. [Environment Variables](#environment-variables)
12. [Development Commands](#development-commands)

---

## What ScopeGuard Does

When a client changes their mind mid-project, agencies need a paper trail. ScopeGuard handles the entire flow:

```
Agency creates change order → Sends approval link to client → Client reviews & signs → Status updates → Webhook fires → Accounting tool notified
```

No PDFs. No email threads. No "I never approved that." Every action is timestamped, signed, and auditable.

---

## Feature Overview

### Change Order Management
- Create, edit, and delete change orders tied to projects and clients
- Auto-calculate totals using accounting-grade integer math (no floating-point drift)
- Status workflow: `DRAFT → SENT → APPROVED / REJECTED / REVISED → SENT`
- Bulk actions: send or delete multiple change orders at once
- Deadline tracking with visual overdue indicators

### Client Approval (No Login Required)
- Each change order gets a unique, unguessable approval token URL
- Clients open the link, review the full scope and price, and click Approve or Reject
- E-signature canvas: clients draw or type their name to legally sign
- Optional comment field for client feedback on rejection or revision requests
- Copy approval link to clipboard in one click

### Projects & Clients
- Organize change orders under projects with hourly rates
- Client contacts with email stored per project
- Archive projects when work is complete
- Project detail view shows all change orders and revenue summary

### Dashboard & Analytics
- Real-time summary: total revenue, pending approvals, active projects, conversion rate
- Recent activity feed across all change orders
- Revenue trend chart (30 days)
- Status distribution pie chart
- Top projects by change order volume

### Notifications
- In-app notification bell with unread count badge
- Notifications fire on: CR sent, CR approved, CR rejected, reminders due
- Mark individual or all as read
- Notifications scoped per organization (multi-tenant safe)

### Automated Reminders
- When a change order is sent, a 48-hour follow-up reminder is automatically scheduled
- Background scheduler runs every 30 minutes to fire due reminders
- View and manage reminders on the Reminders page
- Manually trigger reminders from the UI

### Automation Dashboard
- View all configured automation rules
- See scheduler status and last-run times
- Upcoming reminders queue with time-to-fire

### Webhook Integrations
- Register webhook endpoints (Zapier, Make, Slack, custom URLs)
- Supported events: `change_request.approved`, `change_request.rejected`, `change_request.sent`, `change_request.revised`, `project.completed`
- All payloads signed with HMAC-SHA256 in Stripe-compatible format (`t=...,v1=...`)
- Delivery log with response status, body, and timestamp
- Test-fire any webhook from the UI

### Audit Log
- Every mutation (send, approve, reject, create, delete, team changes) is recorded
- Field-level diffs show exactly what changed (old value → new value)
- Filter by resource type, date range, or user
- Atomic writes: if the audit log fails, the mutation rolls back (SOC 2 safe)

### Team Management
- Invite team members by email with role assignment
- Roles: `ADMIN`, `PROJECT_MANAGER`, `FINANCE_VIEWER`
- Role-based access: only ADMINs and PROJECT_MANAGERs can send/edit COs
- Remove members, change roles

### Exports
- Export change orders to CSV
- Filter exports by status, date range, project
- Export audit logs for compliance reporting

### Saved Views
- Save filter combinations (status + date range + search) as named views
- Quickly switch between saved views on the change orders page
- Views are per-organization

### Global Search
- Search across change orders, projects, and client contacts from a single search bar
- Keyboard shortcut: `Cmd+K` / `Ctrl+K`
- Real-time results as you type

### Security
- Auth rate limiting: 20 attempts per 15 minutes on login/register
- Global rate limit: 300 requests per minute per IP
- Approval route rate limit: 30 per minute
- Trust proxy configured for accurate IP detection behind Replit's reverse proxy

---

## How to Use the App

### Getting Started

1. **Register an account** at `/register`. Enter your agency name, your name, email, and password. This creates your organization.

2. **Log in** at `/login` with your credentials.

3. You land on the **Dashboard**, which shows a summary of your activity.

---

### Step 1 — Add a Client Contact

Go to **Contacts** (`/contacts`) → click **New Contact**.

Fill in:
- Client name
- Email address (this is where approval links are sent)
- Company (optional)
- Phone (optional)

---

### Step 2 — Create a Project

Go to **Projects** (`/projects`) → click **New Project**.

Fill in:
- Project name
- Client contact (select from your contacts)
- Hourly rate in dollars (e.g. `150` for $150/hr)

The hourly rate is used to auto-calculate all change order totals for this project.

---

### Step 3 — Create a Change Order

Go to **Change Orders** (`/change-requests`) → click **New Change Order**.

Fill in:
- Project (select from your projects)
- Title (e.g. "Add payment gateway integration")
- Description (detailed scope of work)
- Estimated hours (e.g. `8`)
- Deadline (optional)

The total is calculated automatically: `hours × hourly rate`. Financial math uses integer cents internally so $150/hr × 8hrs = $1,200.00 exactly, every time.

The change order is created in **DRAFT** status.

---

### Step 4 — Send for Approval

From the Change Orders list, find your DRAFT order and click **Send**.

This:
- Sets status to **SENT**
- Generates a unique approval link
- Schedules a 48-hour follow-up reminder
- Creates an audit log entry (atomically with the status change)
- Fires a `change_request.sent` webhook to any registered endpoints
- Sends an in-app notification to team members

To share the link: click the **copy link** icon next to any SENT change order.

---

### Step 5 — Client Reviews and Signs

Your client opens the approval link (no login needed). They see:

- Agency name and logo area
- Full scope description
- Estimated hours and total cost
- Deadline (if set)
- **Approve** and **Reject** buttons
- E-signature canvas (appears when they click Approve)
- Comment field (appears when they click Reject)

When the client signs and clicks **Confirm Approval**:
- Status becomes **APPROVED**
- Their signature is stored
- Their signed name is recorded
- Approval timestamp and IP address are logged
- A `change_request.approved` webhook fires

---

### Step 6 — Track and Manage

Back on your dashboard:
- The approved amount appears in your revenue total
- The change order shows **APPROVED** with the client's signed name
- The audit log shows the full chain of events

If the client **rejected**:
- Status becomes **REJECTED**
- Their reason/comment is stored
- You can revise the order (changes status to **REVISED**) and re-send

---

### Bulk Actions

On the Change Orders page, check the checkbox next to multiple orders and use the bulk action bar to:
- **Send all** selected DRAFT orders at once
- **Delete all** selected DRAFT orders

---

### Setting Up Webhooks

Go to **Settings → Webhooks** (accessible from the sidebar).

1. Click **Add Webhook**
2. Enter a name, your endpoint URL, and select events to subscribe to
3. Copy the signing secret shown after creation
4. In your receiving endpoint, verify the `X-ScopeGuard-Signature` header:

```javascript
// Signature format: "t=1714752000,v1=abc123..."
// Parse t (timestamp) and v1 (HMAC-SHA256 hex)
// Verify: HMAC-SHA256(secret, `${t}.${sortedJsonPayload}`) === v1
// Reject if abs(now - t) > 300 seconds (replay attack window)
```

Click **Test** on any webhook to fire a test payload and see the delivery log.

---

### Automation Page

Go to **Automation** (`/automation`) to see:
- Background scheduler status
- Configured automation rules (reminder scheduling)
- Upcoming reminder queue

---

### Audit Log

Go to **Audit Log** (`/audit-log`) to see every action ever taken in your organization. Filter by:
- Resource type (change_request, project, contact, team)
- User
- Date range

Each entry shows the action, who did it, from what IP, and what fields changed.

---

### Team Members

Go to **Team** (`/team`) to:
- Invite colleagues by email with a role
- Change roles (ADMIN, PROJECT_MANAGER, FINANCE_VIEWER)
- Remove members

**Role capabilities:**
| Role | Create/Edit COs | Send COs | Approve/Reject | View Analytics |
|------|----------------|----------|----------------|----------------|
| ADMIN | Yes | Yes | Yes | Yes |
| PROJECT_MANAGER | Yes | Yes | No (client only) | Yes |
| FINANCE_VIEWER | No | No | No | Yes |

---

### Exports

Go to **Exports** (`/exports`) to download change order data as CSV for use in Excel, QuickBooks, or other tools.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19 | UI component framework |
| **Vite** | 6 | Dev server and build tool |
| **TypeScript** | 5 | Type safety across the codebase |
| **Tailwind CSS** | 4 | Utility-first CSS styling |
| **shadcn/ui** | latest | Pre-built accessible UI components |
| **Radix UI** | 2.x | Headless accessible primitives (Dialog, Select, Toast, etc.) |
| **TanStack Query** | 5 | Server state management, caching, background refetch |
| **Wouter** | 3 | Lightweight SPA router with hooks |
| **React Hook Form** | 7 | Form state management |
| **Zod** | 3 | Schema validation (shared with backend) |
| **Recharts** | 2 | Responsive charts (revenue trend, status pie) |
| **Framer Motion** | 11 | Animation library |
| **date-fns** | 3 | Date formatting utilities |
| **Lucide React** | latest | Icon library |
| **next-themes** | 0.4 | Dark/light mode theming |
| **sonner** | 2 | Toast notifications |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 24 | JavaScript runtime |
| **Express** | 5 | HTTP server framework |
| **express-session** | 1.19 | Session-based authentication |
| **express-rate-limit** | 8 | Auth and global rate limiting |
| **Drizzle ORM** | 0.40 | Type-safe PostgreSQL query builder |
| **PostgreSQL** | 16 | Relational database |
| **Zod** | 3 | Request body validation |
| **Pino** | 9 | Structured JSON logging |
| **pino-http** | 10 | Per-request logging middleware |
| **esbuild** | 0.27 | Fast TypeScript bundler (ESM output) |
| **cookie-parser** | 1.4 | Cookie parsing middleware |
| **cors** | 2 | Cross-origin resource sharing |

### Monorepo & Tooling

| Technology | Purpose |
|-----------|---------|
| **pnpm workspaces** | Monorepo package management |
| **Orval** | OpenAPI → TanStack Query hooks + Zod schemas codegen |
| **TypeScript project references** | Incremental builds across packages |

---

## Architecture

```
workspace/
├── artifacts/
│   ├── api-server/           Express API — serves /api
│   │   ├── src/
│   │   │   ├── routes/       One file per resource domain
│   │   │   ├── middlewares/  auth, rate limiting
│   │   │   └── lib/          8 core utility modules (see below)
│   │   └── build.mjs         esbuild config (ESM bundle)
│   │
│   └── scopeguard/           React frontend — serves /
│       └── src/
│           ├── pages/        One file per route
│           ├── components/   Shared UI components
│           ├── hooks/        Custom React hooks
│           └── lib/          Utility helpers
│
├── lib/
│   ├── db/                   Drizzle schema + PostgreSQL client
│   ├── api-spec/             OpenAPI 3.0 specification
│   ├── api-zod/              Generated Zod schemas (from OpenAPI)
│   └── api-client-react/     Generated TanStack Query hooks (from OpenAPI)
│
└── scripts/                  Shared utility scripts
```

**Traffic routing:** A global reverse proxy routes `/api/*` to the Express server on port 8080 and everything else to the Vite frontend. No Vite proxy config needed — the platform proxy handles it.

---

## Core Utility Libraries

These 8 production-grade TypeScript modules live in `artifacts/api-server/src/lib/` and `artifacts/scopeguard/src/`. They handle the hardest parts of a financial SaaS correctly.

### 1. `financial.ts` — Deterministic Money Math

```typescript
import { calculateScopeTotalCents } from "./lib/financial";

const { subtotalCents, taxCents, totalCents, baseUsdCents } =
  calculateScopeTotalCents(
    8,        // hours
    15000,    // rate in cents ($150.00/hr)
    {
      taxRateBps: 875,   // 8.75% tax in basis points
      currencyRate: 0.85 // EUR→USD conversion (optional)
    }
  );
// subtotalCents: 120000 ($1,200.00)
// taxCents: 10500 ($105.00)
// totalCents: 130500 ($1,305.00)
```

All arithmetic uses integers. Rounding follows ROUND_HALF_UP (accounting standard, matches QuickBooks/Xero). Throws on invalid inputs — no silent NaN propagation.

---

### 2. `workflow.ts` — Change Order State Machine

```typescript
import { validateStateTransition } from "./lib/workflow";

const result = validateStateTransition("DRAFT", "SENT", "PROJECT_MANAGER");
// → { allowed: true }

const denied = validateStateTransition("APPROVED", "SENT", "ADMIN");
// → { allowed: false, errorCode: "TERMINAL_STATE", errorMessage: "..." }
```

Enforces RBAC rules at the API layer before any DB write. Returns a typed `TransitionResult` — no magic strings, no silent failures.

**State diagram:**
```
DRAFT ──────────────► SENT ──► APPROVED (terminal)
  ▲                    │
  │                    ├──► REJECTED ──► DRAFT / REVISED
  │                    └──► REVISED ──► SENT / DRAFT
  └────────────────────────────────────────────────────
```

---

### 3. `queries.ts` — N+1-Free Query Builder

```typescript
import { buildChangeRequestQuery } from "./lib/queries";

const results = await buildChangeRequestQuery(organizationId, {
  status: ["SENT", "DRAFT"],
  search: "landing page",
  minAmountCents: 50000,
  dateFrom: "2026-01-01",
  limit: 25,
  offset: 0,
});
// Single SQL query — one JOIN, all filters, enriched with project + client data
```

All filters use indexed columns. Pagination capped at 200. Multi-tenancy enforced: every query is scoped to `organizationId`.

---

### 4. `diff.ts` — Field-Level Audit Diff

```typescript
import { objectDiff, toAuditSnapshot } from "./lib/diff";

const before = toAuditSnapshot(oldRow);
const changes = objectDiff(before, newRow);
// → [{ field: "status", oldValue: "DRAFT", newValue: "SENT", fieldType: "string", changedAt: "..." }]
```

Only changed fields are recorded. Sensitive fields (`passwordHash`, `approvalToken`) are excluded by default. Output is JSON-serializable and renders directly in the audit log UI.

---

### 5. `transaction.ts` — Atomic DB + Audit Log Writes

```typescript
import { atomicWithAudit } from "./lib/transaction";

const updated = await atomicWithAudit(
  async (tx) => {
    const [row] = await tx.update(changeRequestsTable)
      .set({ status: "SENT" })
      .where(eq(changeRequestsTable.id, id))
      .returning();
    return row;
  },
  {
    organizationId,
    userId: user.id,
    action: "CR_SENT",
    resourceType: "change_request",
    resourceId: id,
    before: beforeSnapshot,
    after: afterSnapshot,
  }
);
// If either the DB update OR the audit log write fails → full rollback
```

This is the SOC 2 compliance guarantee: you will never have a DB mutation without a corresponding audit record, and you will never have an audit record for a mutation that was rolled back.

---

### 6. `webhookSigning.ts` — HMAC-SHA256 Webhook Security

```typescript
import { signWebhookPayload, verifyWebhookSignature } from "./lib/webhookSigning";

// Signing (when sending)
const sig = signWebhookPayload(payload, process.env.WEBHOOK_SECRET);
// → "t=1714752000,v1=3a4b5c..."

// Verifying (in receiver)
const valid = verifyWebhookSignature(payload, req.headers["x-scopeguard-signature"], secret);
// Checks: HMAC match + timestamp within 5-minute window (replay attack prevention)
// Uses timingSafeEqual to prevent timing attacks
```

Signature format matches Stripe's standard — any Stripe webhook library can verify ScopeGuard webhooks with minor config.

---

### 7. `hooks/use-debounced-filter.ts` — Smart Filter Hook (Frontend)

```typescript
import { useDebouncedFilter } from "@/hooks/use-debounced-filter";

const { filters, apply, applyNow, reset } = useDebouncedFilter(
  { search: "", status: "ALL" },
  { delay: 300, excludeFromUrl: ["search"] } // status syncs to URL, search doesn't
);

// In a search input — debounced 300ms, won't spam the API on every keystroke
<Input onChange={(e) => apply({ search: e.target.value })} />

// On a status toggle — immediate, no debounce
<Select onValueChange={(v) => applyNow({ status: v })} />
```

URL sync means filter state survives page refreshes and is shareable as a bookmark. Works with Wouter's `useLocation` and `useSearch`.

---

### 8. `lib/optimistic.ts` — Optimistic UI Updates (Frontend)

```typescript
import { optimisticMutation } from "@/lib/optimistic";

await optimisticMutation({
  queryClient,
  queryKey: ["change-requests"],
  optimisticItem: { ...newCR, status: "DRAFT", _optimistic: true },
  mutationFn: () => api.post("/api/change-requests", payload),
  onSuccess: (real) => toast({ title: "Created!" }),
  toastError: (msg) => toast({ title: "Failed", description: msg, variant: "destructive" }),
});
// Item appears instantly → real data replaces it on success → rolled back on failure
```

Zero layout thrashing: the store update is synchronous. Rollback is automatic — original cache snapshot is restored on any error.

---

## Database Schema

```
organizations         users
──────────────        ──────────────
id                    id
name                  organizationId → organizations.id
createdAt             name
                      email
                      passwordHash
                      role (ADMIN | PROJECT_MANAGER | FINANCE_VIEWER)
                      createdAt

client_contacts       projects
───────────────       ──────────────
id                    id
organizationId        organizationId → organizations.id
name                  clientContactId → client_contacts.id
email                 name
company               hourlyRateCents
phone                 status (ACTIVE | ARCHIVED)
createdAt             createdAt

change_requests       audit_logs
───────────────       ──────────────
id                    id
projectId             organizationId
status (enum)         userId
estimatedHours        userEmail
hourlyRateCents       action (enum: CR_SENT, CR_APPROVED, ...)
totalCents            resourceType
approvalToken         resourceId
approvedAt            resourceLabel
approvedByIp          fieldChanges (jsonb)
clientSignature       metadata (jsonb)
clientSignedName      ipAddress
clientComments        createdAt
deadline
createdAt / updatedAt

activity_log          notifications
────────────          ─────────────
id                    id
changeRequestId       organizationId
projectId             type
action (enum)         title / body
totalCents            isRead
createdAt             resourceType / resourceId
                      createdAt

webhooks              webhook_deliveries
────────              ──────────────────
id                    id
organizationId        webhookId → webhooks.id
name                  eventType
url                   payload (jsonb)
events (jsonb array)  responseStatus
secret                responseBody
isActive              status (SUCCESS | FAILED)
createdAt             deliveredAt

reminders             saved_views         team_invites
─────────             ───────────         ────────────
id                    id                  id
organizationId        organizationId      organizationId
changeRequestId       name                email
scheduledFor          filters (jsonb)     role
delayHours            createdAt           token
isSent                                    acceptedAt
createdAt                                 createdAt
```

---

## API Reference

All endpoints require authentication (session cookie) unless noted.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account + organization |
| POST | `/api/auth/login` | Start session |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |

### Change Requests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/change-requests` | List (filterable: status, projectId, search) |
| POST | `/api/change-requests` | Create |
| GET | `/api/change-requests/:id` | Get by ID |
| PATCH | `/api/change-requests/:id` | Update (DRAFT/REVISED only) |
| DELETE | `/api/change-requests/:id` | Delete (DRAFT only) |
| POST | `/api/change-requests/:id/send` | Transition to SENT |
| POST | `/api/change-requests/bulk` | Bulk send or delete |

### Approval (no auth — client-facing)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/approval/:token` | Get CR details by token |
| POST | `/api/approval/:token/approve` | Approve with signature |
| POST | `/api/approval/:token/reject` | Reject with comment |

### Projects, Contacts, Team, Webhooks, etc.
Standard CRUD under `/api/projects`, `/api/client-contacts`, `/api/team`, `/api/webhooks`, `/api/audit-logs`, `/api/notifications`, `/api/reminders`, `/api/saved-views`, `/api/exports`.

---

## Security Model

| Layer | Implementation |
|-------|----------------|
| **Authentication** | express-session with `SESSION_SECRET` env var. Session cookie is `httpOnly`, `sameSite: lax`. |
| **Password hashing** | SHA-256 + SESSION_SECRET (salt). |
| **Rate limiting** | 300 req/min global; 20/15min on auth endpoints; 30/min on approval endpoint. |
| **Multi-tenancy** | Every DB query is scoped to `organizationId` from the session. No cross-org data leakage possible. |
| **Client approval tokens** | 32-byte hex random token (`crypto.randomBytes(32)`). Unguessable, not sequential. |
| **Webhook signatures** | HMAC-SHA256 with per-webhook secrets. Stripe-format header. 5-minute replay window enforced. Constant-time comparison. |
| **Audit atomicity** | `atomicWithAudit` wraps mutations in Drizzle transactions — partial writes impossible. |
| **Trust proxy** | `app.set("trust proxy", 1)` configured for accurate IP detection behind Replit's proxy. |

---

## Running Locally

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (or use Replit's built-in DB)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
# SESSION_SECRET=<random 32+ char string>
# DATABASE_URL=<postgresql://...>

# 3. Push database schema
pnpm --filter @workspace/db run push

# 4. Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 5. Start frontend (in a second terminal)
pnpm --filter @workspace/scopeguard run dev
```

The frontend proxies `/api` requests to port 8080 via the shared reverse proxy.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Secret for signing session cookies and hashing passwords. Min 32 chars. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `PORT` | Auto | Injected by Replit per artifact. Do not hardcode. |

---

## Development Commands

```bash
# Full typecheck (libs + artifacts)
pnpm run typecheck

# Rebuild shared lib declarations only
pnpm run typecheck:libs

# Regenerate API hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to dev database
pnpm --filter @workspace/db run push

# Build API server for production
pnpm --filter @workspace/api-server run build

# Run API server (after build)
pnpm --filter @workspace/api-server run start
```

---

## Demo Account

| Field | Value |
|-------|-------|
| Email | `jordan@pixelco.dev` |
| Password | `password123` |
| Organization | Pixel & Co Agency |
| Role | ADMIN |

This account has pre-seeded projects, clients, and change orders in various states for exploration.

---

## Contributing & Code Conventions

- **No `console.log` in server code** — use `req.log` in route handlers and the singleton `logger` for background tasks
- **All money in integer cents** — never store or calculate in floating-point dollars
- **All DB mutations through `atomicWithAudit`** for any action that needs an audit trail
- **Zod v3 API** — use `z.string().email()`, not `z.email()`
- **TypeScript strict mode** — no implicit `any`, no unchecked index access
- **Multi-tenancy enforced at query level** — always include `organizationId` in WHERE clauses
