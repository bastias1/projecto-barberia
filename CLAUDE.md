# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Navaja** (name in `lib/plataforma.ts`) — SaaS for barber shops: each barbería gets its own page with online booking, shop and a staff dashboard. Started as the site of Barbería BENJVMIN (Valdivia, Chile), now `/benjvmin`.
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
- **Project:** `plataforma-barberia` (project ID: `jrffkkktryskigbglpit`) — the one in `.env.local`. The old project `iuhmjpqwkueueakybgaz` is no longer accessible (it only still serves the logo images).
- Use MCP tools to inspect schema, run queries, or apply migrations directly — no need to guess table structures.
- Business rules live in the database (triggers): prices, totals, stock, booking validation, plan limits. Read the trigger before "fixing" something in the app.

### Supabase Client Strategy
Three distinct clients — use the right one for the context:
- `utils/supabase/client.ts` — browser client (Client Components)
- `utils/supabase/server.ts` — server client with cookie session (Server Components, Route Handlers that need auth)
- `utils/supabase/service-role.ts` — bypasses RLS. Only for: the MercadoPago webhook, admin API routes after `requireAdmin()` (`lib/admin-auth.ts`), signed email links after `verifyLink()` (`lib/signed-links.ts`), and transactional emails (`lib/notifications.ts`)

Middleware lives at `utils/supabase/middleware.ts` and is re-exported from `proxy.ts` at the root (Next.js requires the file to be named `middleware.ts` or `middleware.js` at root, but the project exports a `proxy` function—this is intentional to avoid conflicts).

### Multi-tenant routing
- `/` — the software's landing page (features, plans read from `plan_suscripcion`). `/registro` — a logged-in user registers a barbería (RPC `registrar_barberia`: 14-day trial, user becomes admin, first sucursal).
- `/[slug]/...` — everything of one barbería: home, `agendar`, `tienda`, `cart`, `checkout`, `profile`, `booking-*` and `dashboard/*`.
- `/[slug]/[sucursal]` — page of one branch (address, map, hours, its barbers). Booking for a branch: `/[slug]/agendar?sucursal=<slug>` (`/[slug]/[sucursal]/agendar` redirects there); with several branches and no `?sucursal`, agendar starts with a "Sucursal" step. Branch slugs can't be the sibling route names (CHECK `sucursal_slug_no_reservado`). `app/[slug]/layout.tsx` resolves it (404 if missing/inactive) and wraps the tree in `BarberiaProvider`.
- Root-level shared routes: `/login` and `/signup` (take `?barberia=<slug>&next=<path>`), `/auth/callback`, `/resena`, `/cuenta` (account hub: pending invitations, my barberías, `/cuenta/clave` to change password), `/invitacion/[token]` (email link), `/api/*`.
- Old single-barbershop URLs (`/agendar`, `/tienda`, `/dashboard`…) redirect to `/benjvmin/...` (`next.config.ts`). Those words and the platform routes are reserved slugs (CHECK `barberia_slug_no_reservado`): add new top-level routes there too.

Every query must filter by `id_barberia`. Never hardcode a barbería:
- Server Components: `getBarberiaCached(slug)` (`lib/barberia-server.ts`, cached per request) from `params`.
- Client Components under `/[slug]`: `useBarberia()` / `useBarberiaHref()` (`components/barberia-provider.tsx`) for the id and internal links.
- Services take `idBarberia` as first argument. API routes receive the slug (`?barberia=` or body `barberia`) and resolve it with `getBarberiaBySlug()`; emails/signed links resolve it from the booking/order (`getBarberiaById()`).

### Service Layer
All database logic lives in `lib/services/`:
- `barber-service.ts` — public barber list (RPC `profesionales_publicos`), optionally only those assigned to a branch
- `booking-service.ts` — available time slots (RPCs `dias_bloqueados`, `horarios_ocupados` + `horario_atencion`), optionally for one branch; inactive branches are ignored. Bookings are created by the server action `app/[slug]/agendar/actions.ts` via RPC `reservar_como_invitado`
- `dashboard-service.ts` — barber stats, appointments, clients, client blocking
- `product-service.ts` — CRUD for shop products, image uploads to Supabase Storage (`imgs` bucket)
- `schedule-service.ts` — `horario_atencion` (weekly schedule, per sucursal) and `dia_bloqueado` (blocked dates)
- `service-service.ts` — services (`servicio`), barber↔service linking (`profesional_servicio`)

Services alias columns (`id:id_producto`, `duracion:duracion_min`, …) so the UI keeps simple shapes. Embedded relations come back as object or array: normalize with `one<T>()` from `lib/utils.ts`.

Other shared modules: `lib/staff-context.ts` (`getStaffContext(slug)` cached per request; dashboard pages call `requireStaff(slug, { admin })`, which redirects), `lib/roles.ts` (`getRolApp`, `getMembresias`, `destinoTrasLogin`), `lib/barberia-publica.ts` (home page data), `lib/planes.ts`, `lib/datetime.ts` (timezone helpers), `lib/pedido-estados.ts` (order status labels), `lib/review-link.ts`.

`'use server'` files may only export async functions — exporting a type there breaks the module at runtime.

### Database Schema (manual — `lib/database.types.ts`)

`database.types.ts` is **manually maintained** — update it when the DB schema changes (not auto-generated from Supabase CLI). Full DDL in `BDD.SQL`, policies in `RLS.sql`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `barberia`, `sucursal` | `id_barberia`, `slug`, `logo_url`, `logo_oscuro_url`, `eslogan`, `descripcion`, `instagram`, `galeria`; `id_sucursal`, `slug` (auto from `nombre` if empty), `zona_horaria` | Tenant (public page content and branches edited in Dashboard → Mi Barbería) and its branches |
| `plan_suscripcion`, `plan_modulo`, `plan_limite`, `suscripcion`, `suscripcion_modulo`, `modulo`, `tipo_limite` | | SaaS plans; triggers enforce modules (`ecommerce`, `bi`) and limits |
| `usuario` | `id_usuario` (=auth.users.id), `email`, `rol` ('superadmin'/'usuario'), `rut` (encrypted), `deleted_at` | `authenticated` can only UPDATE nombre/apellido/telefono/rut/profile_image (column grants) |
| `usuario_barberia` | `id_usuario`, `id_barberia`, `rol` ('admin'/'profesional'/'cliente'), `activo` | Role per barbershop |
| `profesional` | `id_barberia`, `id_profesional`, `alias`, `especialidad`, `activo` | Barber profile (has agenda) |
| `servicio`, `profesional_servicio` | `id_servicio`, `duracion_min`, `precio`, `activo` | |
| `profesional_sucursal` | `id_profesional`, `id_sucursal` | Branches where a barber works (admin assigns them in Mi Barbería). Public read. Removing one deactivates the barber's hours there |
| `horario_atencion` | `id_horario`, `id_profesional`, `id_sucursal`, `dia_semana`, `hora_inicio`, `hora_fin`, `activo` | No overlaps (exclusion constraint, 23P01); an active row must be in a branch assigned to the barber (23514) |
| `dia_bloqueado` | `id_dia_bloqueado`, `id_profesional`, `fecha`, `motivo` | |
| `guest_usuario` | `id_guest`, `id_barberia`, `correo` (unique per barbería) | Unregistered clients |
| `reserva` | `id_reserva`, `fecha_hora_inicio`/`fin` (timestamptz), `estado` ('pendiente'/'confirmada'/'completada'/'cancelada'/'no_asistio'), `id_cliente` XOR `id_guest`, `monto` | Trigger sets `fecha_hora_fin` and `monto`, validates schedule; history in `reserva_historial` |
| `producto` | `id_producto`, `stock`, `stock_minimo`, `activo` | |
| `pedido` / `detalle_pedido` | `estado` ('pendiente'…'entregado'/'cancelado'), `estado_pago`, `monto_total` | Triggers set prices, deduct/return stock, totals |
| `pago` | `concepto`, `proveedor`, `id_transaccion_externa`, `estado` | Inserting a payment updates the order (`aplicar_pago_a_pedido`) |
| `resena` | `id_resena`, `calificacion` 1-5, `id_cliente` XOR `id_guest`, `id_reserva`/`id_producto` | Only completed bookings / delivered products |
| `invitacion` | `id_barberia`, `correo`, `rol`, `token`, `estado` (pendiente/aceptada/rechazada/cancelada), `expira_at` | Team invitations. Insert trigger checks active subscription, existing members and `max_profesionales`; accepted only through RPC `responder_invitacion` |
| `cliente_bloqueado` | `id_barberia`, `correo` (lowercase), `telefono`, `razon` | Checked inside `reservar_como_invitado` |
| `direccion_usuario`, `consentimiento`, `prediccion_demanda` | | |

All tables have **RLS enabled** (helpers `private.es_admin/es_staff/es_superadmin`). Public data for anonymous visitors goes through SECURITY DEFINER RPCs (`profesionales_publicos`, `horarios_ocupados`, `dias_bloqueados`, `resenas_publicas`, `reservar_como_invitado`).

### Role-Based Routing
Roles are per barbería (`usuario_barberia`), so the same user can be admin of one and client of another.
- `superadmin`, `admin`, `profesional` → `/<slug>/dashboard` (admin also sees Usuarios, Mi Barbería, Productos, Pedidos)
- `cliente` → `/<slug>` and `/<slug>/profile`
- After login: `?next` if given, else `destinoTrasLogin()` (dashboard where they work, or their only barbería).
- Everyone creates their own account (signup). Staff join a barbería by **invitation**: the admin invites an email in Dashboard → Equipo (`app/[slug]/dashboard/usuarios`, server actions in `actions.ts`); the person accepts at `/cuenta` or `/invitacion/[token]` (RPC `responder_invitacion`). Invitations can target emails without an account yet. Admins can change roles/especialidad (`/api/admin/update-user`) or remove members, but not other users' email/password.
- After login without a barbería context and without staff role → `/cuenta`. Password recovery: `resetPasswordForEmail` → `/auth/callback?next=/cuenta/clave`.
- Signup with `?barberia=` creates a client of that barbería; without it, only the user. Buying in a barbería also adds the client membership.

### Dashboard agenda (Citas)
- `/[slug]/dashboard/citas?vista=semana|mes&fecha=YYYY-MM-DD` — state kept in the URL with `history.replaceState`. Week view: day×hour table on desktop, swipeable day carousel on mobile (edge slides switch week). Keys ←/→ and T.
- "+ Nueva cita" (`crearCitaManual` in `app/[slug]/dashboard/citas/actions.ts`) reuses `crearReserva`; staff slots use `getAvailableTimeSlots(..., minAnticipacionMs = 0)`.
- Realtime: `reserva` is in the `supabase_realtime` publication; `components/dashboard/reservas-realtime.tsx` (mounted in the dashboard layout for barbers) toasts new/cancelled bookings and calls `router.refresh()`.

### Emails (Resend)
All email goes through Resend from the verified domain `sunwalk.app` (`EMAIL_FROM="Navaja <notificaciones@sunwalk.app>"`).
- App emails: `lib/email.ts` (`sendEmail` adds a plain-text version, `fromName` = barbería name, `replyTo` = barbería `email_contacto`) + `lib/notifications.ts`. Sent on: booking created (confirm/cancel links), booking `completada` and order `entregado` (review link → `/resena`), team invitation (`/invitacion/<token>`). Links are HMAC-signed with `BOOKING_SECRET` (invitations use their random token). Without `RESEND_API_KEY` emails are skipped and links are logged to the server console.
- Supabase Auth emails (signup confirmation, password recovery, email change, magic link) use Resend's SMTP configured in the Supabase dashboard (`smtp.resend.com:465`, user `resend`, password = API key). Spanish templates live in `supabase/templates/` (paste them in Authentication → Emails → Templates).

### Cart State
Zustand store with `persist` middleware in `lib/cart-store.ts`. Persists to `localStorage` under key `cart-storage`. The cart belongs to one barbería (`slug`): use `useBarberiaCart()`, which hides another barbería's cart; adding a product from another barbería starts a new cart.

### Subscription and modules
- Modules in force come from RPC `modulos_barberia` (`getModulosCached` in `lib/barberia-server.ts`, `useModulo()`/`useModulos()` in `components/barberia-provider.tsx`). A subscription is in force while `estado` is prueba/activa **and** `fecha_termino` is null or not past. Without `agenda` online booking closes; without `ecommerce` the shop and Productos/Pedidos are hidden (`RequiereModulo`, `ModuloNoDisponible`); without `bi`, Estadísticas.
- Owner pays in Dashboard → Suscripción with MercadoPago **preapproval** (`/api/suscripcion/checkout`, `/api/suscripcion/cancelar`). The webhook handles `subscription_preapproval` and `subscription_authorized_payment` via `lib/suscripcion.ts` (authorized → activa with the chosen plan; each approved charge extends `fecha_termino` 1 month + 5 days and records a `pago` with concepto `suscripcion`; cancelled → no renewal, valid until `fecha_termino`).

### Payments (MercadoPago)
- `POST /api/checkout` — creates `pedido` + `detalle_pedido` (DB sets prices and deducts stock) and a MercadoPago preference with DB prices; body includes `barberia` (slug); return URLs are `/<slug>/checkout/*`; returns `init_point` URL. If stock or MercadoPago fails, the order is cancelled (stock returned)
- `POST /api/webhooks/mercadopago` — verifies HMAC-SHA256 signature (`MERCADOPAGO_WEBHOOK_SECRET`), upserts a `pago` row (unique per MercadoPago payment id); the trigger updates `pedido.estado_pago` and moves paid orders to `confirmado`

### Key Conventions
- **Dates**: Bookings are `timestamptz`. Convert with `lib/datetime.ts` (`toZoned`, `fromZoned`, `todayIn`) using the sucursal timezone (`America/Santiago`) — the server runs in UTC. For dates picked in a calendar use `localDateString()`; never `.toISOString()` for a calendar date.
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
BOOKING_SECRET            # signs email links
RESEND_API_KEY, EMAIL_FROM # sender address; the name shown is each barbería's
NEXT_PUBLIC_SITE_URL      # base URL for email links and MercadoPago return URLs
DATA_ENCRYPTION_KEY       # RUT encryption (utils/encryption.ts)
```

### Remote Patterns
Supabase Storage images are served from the current project (host taken from `NEXT_PUBLIC_SUPABASE_URL`) and the old `iuhmjpqwkueueakybgaz.supabase.co` (logos) — configured in `next.config.ts`. Bucket `imgs`: `productos/<id_barberia>/` and `barberias/<id_barberia>/` (logo, galería) — only that barbería's admin can write; `avatars/<user-id>-*` (owner). Barbería logos and gallery are rendered with `<img>` (any host).

Instead of avoiding RLS Policy issues find a fix for them and implement it after asking for permission.
