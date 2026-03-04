# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Barbería BENJVMIN** — online booking and e-commerce system for a barber shop in Valdivia, Chile.
Production URL: **https://projecto-barberia.vercel.app/**

Stack: Next.js 16 (App Router) + TypeScript + Supabase + Tailwind v4 + shadcn/ui + Zustand + MercadoPago.

## Commands

```bash
pnpm dev          # Start development server (localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

No test suite is configured.

## Architecture

### Supabase MCP Access
You have direct access to the Supabase database via MCP tools (e.g. `execute_sql`, `list_tables`, `apply_migration`).
- **Project:** `database-barberia` (project ID: `iuhmjpqwkueueakybgaz`)
- Use MCP tools to inspect schema, run queries, or apply migrations directly — no need to guess table structures.

### Supabase Client Strategy
Three distinct clients — use the right one for the context:
- `utils/supabase/client.ts` — browser client (Client Components)
- `utils/supabase/server.ts` — server client with cookie session (Server Components, Route Handlers that need auth)
- `utils/supabase/service-role.ts` — bypasses RLS (webhooks, admin operations only)

Middleware lives at `utils/supabase/middleware.ts` and is re-exported from `proxy.ts` at the root (Next.js requires the file to be named `middleware.ts` or `middleware.js` at root, but the project exports a `proxy` function—this is intentional to avoid conflicts).

### Service Layer
All database logic lives in `lib/services/`:
- `barber-service.ts` — barber profiles, services per barber
- `booking-service.ts` — creating reservations, available time slots
- `dashboard-service.ts` — barber stats, upcoming/today appointments
- `product-service.ts` — CRUD for shop products, image uploads to Supabase Storage (`imgs` bucket)
- `schedule-service.ts` — `horario_barbero` (weekly schedule) and `dia_bloqueado` (blocked dates)
- `service-service.ts` — haircut services (servicio table), barber↔service linking

### Database Schema (manual — `lib/database.types.ts`)
Key tables: `usuario`, `barbero`, `servicio`, `barbero_servicio`, `reserva`, `guest_usuario`, `productos`, `venta`, `detalle_venta`, `horario_barbero`, `dia_bloqueado`.

`database.types.ts` is **manually maintained** — update it when the DB schema changes (not auto-generated from Supabase CLI).

### Role-Based Routing
- `rol = 'barbero'` → `/dashboard` (full barber management UI)
- `rol = 'cliente'` → `/profile`
- Dashboard layout (`app/dashboard/layout.tsx`) auto-creates `barbero` + `usuario` records on first login if missing.

### Cart State
Zustand store with `persist` middleware in `lib/cart-store.ts`. Persists to `localStorage` under key `cart-storage`.

### Payments (MercadoPago)
- `POST /api/checkout` — creates a `venta` record and MercadoPago preference; returns `init_point` URL
- `POST /api/webhooks/mercadopago` — verifies HMAC-SHA256 signature (`MERCADOPAGO_WEBHOOK_SECRET`), updates `venta.estado_pago`; uses service-role client to bypass RLS
- After payment approval, `venta.estado` stays `'pending'` for manual fulfillment from dashboard

### Key Conventions
- **Dates**: Always use local date parts (`getFullYear()`, `getMonth()`, `getDate()`) to build `YYYY-MM-DD` strings. Never use `.toISOString()` — it shifts dates due to UTC conversion.
- **UI language**: All user-facing text is in Spanish (es_CL).
- **Toasts**: `sonner` (`<Toaster />` in root layout). Import `toast` from `"sonner"`.
- **Dark mode**: `next-themes` with `ThemeProvider`. Background gradient pattern: `from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black`.
- **Soft deletes**: Products and services use `activo: false` for archiving rather than hard deletes, to preserve sales/booking history. `getActive*` functions filter on `activo != false`.

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
```

### Remote Patterns
Supabase Storage images are served from `iuhmjpqwkueueakybgaz.supabase.co` — configured in `next.config.ts`.

Instead of avoiding RLS Policy issues find a fix for them and implement it after asking for permission.
