# ScopeGuard

Change order approval workflow SaaS for agencies. Agencies create change requests, send one-click approval links to clients (no login required), and track sign-offs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, TanStack Query, Wouter)
- **Backend**: Express 5 + express-session
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v3), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/`)
- **Build**: esbuild (ESM bundle for API server)

## Artifacts

- `artifacts/scopeguard` — React frontend at `/` (port via `$PORT`)
- `artifacts/api-server` — Express API at `/api` (port 8080 → proxied via `/api`)

## Key Libraries

- `lib/db` — Drizzle ORM schema + client (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec (`@workspace/api-spec`)
- `lib/api-zod` — Generated Zod schemas (`@workspace/api-zod`)
- `lib/api-client-react` — Generated TanStack Query hooks (`@workspace/api-client-react`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Schema

Tables: `organizations`, `users`, `client_contacts`, `projects`, `change_requests`, `activity_log`

Change request states: `DRAFT → SENT → APPROVED | REJECTED | REVISED → (SENT)`

## Auth

- Session-based auth using express-session + SESSION_SECRET env var
- Password hashing: SHA-256 + SESSION_SECRET
- Middleware: `requireAuth` in `artifacts/api-server/src/middlewares/auth.ts`

## Demo Account

- Email: `jordan@pixelco.dev`
- Password: `password123`
- Organization: Pixel & Co Agency

## Important Notes

- Route files use `import { z } from "zod"` (v3 API: `z.string().email()` not `z.email()`)
- After running codegen, `lib/api-zod/src/index.ts` must only export `export * from "./generated/api"` 
- API server builds with esbuild; run build before checking for errors
- The proxy routes `/api` to port 8080 and `/` to the scopeguard frontend port
