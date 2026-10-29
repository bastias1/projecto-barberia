# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Navaja** (name in `lib/plataforma.ts`) — SaaS for barber shops: each barbería gets its own page with online booking, shop and a staff dashboard. Started as the site of Barbería BENJVMIN (Valdivia, Chile), now `/benjvmin`.
Production URL: **https://projecto-barberia.vercel.app/**

Stack: Next.js 16 (App Router) + TypeScript + Supabase + Tailwind v4 + shadcn/ui + Zustand + MercadoPago.

## Requirements spec (`Requerimientos.md`)

Functional spec from the thesis report: user stories HU-xx with acceptance criteria (§5), plan matrix (§4), implementation order (§6), modules (§7), business rules (§8), BI KPIs (§9), NFRs (§10), key test cases CP-xx (§11).
- Before implementing or changing a feature, read its HU in `Requerimientos.md`. Reference the HU id in commits/PRs (`feat(HU-02): ...`).
- The spec is the target; the code and DB are what exists. When they disagree, tell the user instead of silently changing either. Business rules from §8 go in the DB (constraints/triggers), plan modules/limits stay as data (never hardcode the §4 matrix).
- Known divergences between spec and current implementation:
  - Roles: spec `propietario`/`administrador` → `usuario_barberia.rol = 'admin'` (plus `profesional`, `cliente`); platform admin → `usuario.rol = 'superadmin'`.
  - Modules: the DB has only `agenda`, `ecommerce`, `bi`. Spec modules `resenas`, `pronostico`, `calendario`, `soporte_directo` don't exist yet — add them as `modulo`/`plan_modulo` rows.
  - Stock: spec (HU-23) deducts stock only on approved payment; today the DB deducts it when the `pedido` is created and returns it on cancel.
  - Payments: spec (§12.7) changes state only from the webhook; today `/api/checkout/pagar` and `/api/suscripcion/checkout` also record the synchronous Mercado Pago result, with the webhook as the other path.
  - Data model: the spec says it isn't closed; it is now in `BDD.SQL`/`RLS.sql`/`database.types.ts`. Still propose schema changes and ask before applying them. Migrations are applied through the Supabase MCP, not a `supabase/migrations` folder.
  - Tests: spec expects Vitest/Playwright/k6; none is configured yet.
  - Location data (HU-17: dirección, comuna, región, zona horaria) lives on `sucursal`, not `barberia`.
  - Pilot: the spec names Big Cut; production started with BENJVMIN (`/benjvmin`).

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
- `utils/supabase/service-role.ts` — bypasses RLS. Only for: the MercadoPago webhook, recording the result of a shop payment in `/api/checkout/pagar` (`registrarPagoOrder`) and syncing subscription charges (`sincronizarCobros`) in `/api/suscripcion/checkout` and Dashboard → Suscripción, admin API routes after `requireAdmin()` (`lib/admin-auth.ts`), signed email links after `verifyLink()` (`lib/signed-links.ts`), transactional emails (`lib/notifications.ts`), and in `/admin` only changing `usuario.rol`/`deleted_at`, Auth bans and the Auth user/avatar cleanup of `eliminarDatosPersona`, after checking `getSuperadmin()`

Middleware lives at `utils/supabase/middleware.ts` and is re-exported from `proxy.ts` at the root (Next.js requires the file to be named `middleware.ts` or `middleware.js` at root, but the project exports a `proxy` function—this is intentional to avoid conflicts).

### Multi-tenant routing
- `/` — the software's landing page (features, plans read from `plan_suscripcion`). `/registro` — a logged-in user registers a barbería (RPC `registrar_barberia`: 14-day trial, user becomes admin, first sucursal).
- `/[slug]/...` — everything of one barbería: home, `agendar`, `tienda`, `cart`, `checkout`, `profile`, `booking-*` and `dashboard/*`.
- `/[slug]/[sucursal]` — page of one branch (address, map, hours, its barbers). Booking for a branch: `/[slug]/agendar?sucursal=<slug>` (`/[slug]/[sucursal]/agendar` redirects there); with several branches and no `?sucursal`, agendar starts with a "Sucursal" step. Branch slugs can't be the sibling route names (CHECK `sucursal_slug_no_reservado`). `app/[slug]/layout.tsx` resolves it (404 if missing/inactive) and wraps the tree in `BarberiaProvider`.
- Root-level shared routes: `/login` and `/signup` (take `?barberia=<slug>&next=<path>`), `/auth/callback`, `/resena`, `/cuenta` (account hub: pending invitations, my barberías, `/cuenta/clave` to change password), `/invitacion/[token]` (email link), `/api/*`.
- Legal pages (route group `app/(legal)/`, linked from both footers via `LegalLinks`/`LINKS_LEGALES` in `lib/plataforma.ts`): `/terminos`, `/privacidad` (includes the cookies section: only essential cookies, so no banner), `/reembolsos`, `/eliminar-datos`. They are drafts with `[COMPLETAR]` placeholders pending legal review. `VERSION_POLITICA` (`lib/plataforma.ts`) is the version stored in `consentimiento`; bump it when those texts change.
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

Services alias columns (`id:id_producto`, `duracion:duracion_min`, …) so the UI keeps simple shapes. Embedded relations come back as object or array: normalize with `one<T>()` from `lib/utils.ts`. PostgREST silently caps results at 1000 rows: a query that can grow past that (all bookings of a barber, etc.) goes through `todasLasFilas()` (`lib/utils.ts`), ordered by a unique column.

Other shared modules: `lib/staff-context.ts` (`getStaffContext(slug)` cached per request; dashboard pages call `requireStaff(slug, { admin })`, which redirects), `lib/roles.ts` (`getRolApp`, `getMembresias`, `destinoTrasLogin`), `lib/barberia-publica.ts` (home page data), `lib/planes.ts`, `lib/datetime.ts` (timezone helpers), `lib/pedido-estados.ts` (order status labels), `lib/review-link.ts`.

`'use server'` files may only export async functions — exporting a type there breaks the module at runtime.

### Database Schema (manual — `lib/database.types.ts`)

`database.types.ts` is **manually maintained** — update it when the DB schema changes (not auto-generated from Supabase CLI). Full DDL in `BDD.SQL`, policies in `RLS.sql`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `barberia`, `sucursal` | `id_barberia`, `slug`, `logo_url`, `logo_oscuro_url`, `eslogan`, `descripcion`, `instagram`, `galeria`; `id_sucursal`, `slug` (auto from `nombre` if empty), `zona_horaria` | Tenant (public page content and branches edited in Dashboard → Mi Barbería) and its branches |
| `plan_suscripcion`, `plan_modulo`, `plan_limite`, `suscripcion`, `suscripcion_modulo`, `modulo`, `tipo_limite` | | SaaS plans; triggers enforce modules (`ecommerce`, `bi`) and limits |
| `usuario` | `id_usuario` (=auth.users.id), `email`, `rol` ('superadmin'/'usuario'), `rut` (unused: removed from the app, always NULL), `deleted_at` | Created by trigger `crear_perfil_usuario` on `auth.users` (never insert it from the app); email kept in sync on change. `authenticated` can only UPDATE nombre/apellido/telefono/rut/profile_image (column grants) |
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
| `auditoria_admin` | `id_usuario`, `accion`, `entidad` ('barberia'/'plan'/'usuario'), `id_entidad`, `detalle` jsonb | Audit log of the `/admin` panel. Superadmin can SELECT and INSERT (as themselves); no UPDATE/DELETE |
| `direccion_usuario`, `consentimiento`, `prediccion_demanda` | | |

All tables have **RLS enabled** (helpers `private.es_admin/es_staff/es_superadmin`). Public data for anonymous visitors goes through SECURITY DEFINER RPCs (`profesionales_publicos`, `horarios_ocupados`, `dias_bloqueados`, `resenas_publicas`, `reservar_como_invitado`).

### Role-Based Routing
Roles are per barbería (`usuario_barberia`), so the same user can be admin of one and client of another.
- `superadmin`, `admin`, `profesional` → `/<slug>/dashboard` (admin also sees Usuarios, Mi Barbería, Productos, Pedidos)
- `cliente` → `/<slug>` and `/<slug>/profile`
- After login: `destinoTrasLogin(membresias, slug, next)` in `lib/roles.ts` — staff always go to their dashboard (the one of the barbería they came from if they work there) unless `next` is a work route (`/invitacion/…`, `/registro`, `/cuenta…`, a dashboard); a superadmin (`usuario.rol`, `esSuperadmin()`) without barbería context goes to `/admin`; clients go to `next`, their barbería or `/cuenta`. `/login` redirects straight away if there is already a session; the landing shows "Mi panel".
- "Mantener sesión iniciada" (login checkbox) writes cookie `sb-recordar` (1/0). `@supabase/ssr` forces 400-day auth cookies, so the `setAll` of the browser client, server client and middleware pass options through `opcionesCookie()` (`lib/sesion.ts`): with `sb-recordar=0` auth cookies become browser-session cookies.
- Email redirects: signup without a barbería → `/cuenta`; confirmation link opened in another browser (PKCE exchange fails) → `/login?confirmado=1&next=…`; password recovery → `/cuenta/clave` → dashboard or `/cuenta`; invitation → `/invitacion/<token>` → dashboard.
- Everyone creates their own account (signup). Staff join a barbería by **invitation**: the admin invites an email in Dashboard → Equipo (`app/[slug]/dashboard/usuarios`, server actions in `actions.ts`); the person accepts at `/cuenta` or `/invitacion/[token]` (RPC `responder_invitacion`). Invitations can target emails without an account yet. Admins can change roles/especialidad (`/api/admin/update-user`) or remove members, but not other users' email/password.
- `/cuenta` is the account hub: profile (`ProfileForm`), pending invitations, barberías, register a barbería, change password. Equipo shows "Copiar link" for pending invitations; invite actions return `correoEnviado` so a failed email is visible.
- Signup with `?barberia=` creates a client of that barbería; without it, only the user. Buying in a barbería also adds the client membership.
- Consent: signup sends `acepta_terminos`/`version_politica` in the auth metadata; trigger `crear_perfil_usuario` rejects the signup without it and records `consentimiento` (terminos + privacidad). Booking records it in `reservar_como_invitado`, registering a barbería in `app/registro/actions.ts`. Checkboxes are never pre-checked.
- Data deletion (Ley 21.719): requests arrive by email (`/eliminar-datos`); a superadmin executes them in `/admin/usuarios` → "Eliminar datos de una persona" (`eliminarDatosPersona` in `app/admin/actions.ts`): RPC `anonimizar_usuario` + `anonimizar_guest` for every guest row with that email, then (service role) the auth user gets an anonymous email, random password and a ban, and its avatar files are removed. Transactions are kept anonymized; the audit log doesn't store the email.

### Platform panel (`/admin`)
For the software's own administrators: `usuario.rol = 'superadmin'` (grant it from `/admin/usuarios`). `app/admin/layout.tsx` calls `requireSuperadmin()` (`lib/superadmin.ts`): not logged in → `/login?next=/admin`, other users → `/cuenta`.
- Pages: Resumen (barberías by state, MRR, payments, trials ending in 7 days), Barberías (filters/search/pagination) and `/admin/barberias/[id]` (extend vigencia, change plan, cortesía, suspend `barberia.activa`, enter its dashboard), Planes (edit/create `plan_suscripcion` + `plan_modulo` + `plan_limite`; inactive plans are hidden from the landing and Suscripción, existing subscriptions keep `precio_pactado`), Usuarios (search, grant/remove superadmin, suspend), Actividad (audit log).
- Server actions in `app/admin/actions.ts`: each checks `getSuperadmin()`, applies the change with the superadmin's own session (it has `*_superadmin` ALL policies), logs it with `registrarAccion()` into `auditoria_admin` and revalidates. Subscription state helpers and queries: `lib/admin-datos.ts` (`estadoSuscripcion`, `getBarberiasAdmin`, `calcularMRR`).
- Exceptions using service role: `usuario.rol`/`deleted_at` (no column grant) and suspending an account (`auth.admin.updateUserById(id, { ban_duration })`). A superadmin cannot remove their own role or suspend themselves. Cortesía is refused when the barbería has a MercadoPago preapproval.

### Dashboard agenda (Citas)
- `/[slug]/dashboard/citas?vista=semana|mes&fecha=YYYY-MM-DD` — state kept in the URL with `history.replaceState`. Week view: day×hour table on desktop, swipeable day carousel on mobile (edge slides switch week). Keys ←/→ and T.
- "+ Nueva cita" (`crearCitaManual` in `app/[slug]/dashboard/citas/actions.ts`) reuses `crearReserva`; staff slots use `getAvailableTimeSlots(..., minAnticipacionMs = 0)`.
- Realtime: `reserva` is in the `supabase_realtime` publication; `components/dashboard/reservas-realtime.tsx` (mounted in the dashboard layout for barbers) toasts new/cancelled bookings and calls `router.refresh()`.

### BI / Estadísticas (HU-13..16)
- `/[slug]/dashboard/estadisticas?desde=&hasta=&gran=day|week|month` — solo admin de una barbería con el módulo `bi` (`requireStaff(slug, { admin: true })` + `getModulosCached`; el sidebar también lo oculta a profesionales). Sin sesión de admin o sin `bi` las funciones lanzan `insufficient_privilege`.
- Los cálculos están en funciones SQL `bi_*` (`BI.sql`, aplicadas por el MCP): `bi_ingresos`, `bi_servicios`, `bi_productos`, `bi_demanda`, `bi_ocupacion`, `bi_resumen_mensual`, sobre las auxiliares `bi_reservas` y `bi_pedidos_pagados`. Son `SECURITY INVOKER` (RLS sigue aplicando) y verifican con `private.bi_verificar`. Son funciones y no vistas porque necesitan rango y granularidad; las fechas van en la zona horaria de la sucursal.
- Ingresos = reservas `completada` (`reserva.monto`) + pedidos `estado_pago = 'pagado'` (`monto_total`, sin envío). La fecha de un pedido es la de su primer `pago` aprobado.
- App: `lib/services/bi-service.ts` (RPCs), `components/dashboard/bi/bi-charts.tsx` (Recharts, client), `loading.tsx` con esqueletos. El pronóstico (HU-25, `prediccion_demanda`) aún no tiene pantalla. `database.types.ts` no tipa las funciones RPC: `bi-service.ts` las tipa a mano.
- El contenedor del dashboard (`layout.tsx`) tiene altura fija (`h-dvh`) y `<main>` es `relative`: un elemento `sr-only` sin contenedor posicionado estira el documento y deja una franja vacía al final.

### Emails (Resend)
All email goes through Resend from the verified domain `sunwalk.app` (`EMAIL_FROM="Navaja <notificaciones@sunwalk.app>"`).
- App emails: `lib/email.ts` (`sendEmail` adds a plain-text version, `fromName` = barbería name, `replyTo` = barbería `email_contacto`) + `lib/notifications.ts`. Sent on: booking created (confirm/cancel links), booking `completada` and order `entregado` (review link → `/resena`), team invitation (`/invitacion/<token>`). Confirm/cancel links open a page with a button that POSTs (mail scanners open every link, so a GET never changes the booking). Links are HMAC-signed with `BOOKING_SECRET` (invitations use their random token). Without `RESEND_API_KEY` emails are skipped and links are logged to the server console.
- Supabase Auth emails (signup confirmation, password recovery, email change, magic link) use Resend's SMTP configured in the Supabase dashboard (`smtp.resend.com:465`, user `resend`, password = API key). Spanish templates live in `supabase/templates/` (paste them in Authentication → Emails → Templates).

### Cart State
Zustand store with `persist` middleware in `lib/cart-store.ts`. Persists to `localStorage` under key `cart-storage`. The cart belongs to one barbería (`slug`): use `useBarberiaCart()`, which hides another barbería's cart; adding a product from another barbería starts a new cart.

### Subscription and modules
- Modules in force come from RPC `modulos_barberia` (`getModulosCached` in `lib/barberia-server.ts`, `useModulo()`/`useModulos()` in `components/barberia-provider.tsx`). A subscription is in force while `estado` is prueba/activa **and** `fecha_termino` is null or not past. Without `agenda` online booking closes; without `ecommerce` the shop and Productos/Pedidos are hidden (`RequiereModulo`, `ModuloNoDisponible`); without `bi`, Estadísticas.
- Owner pays in Dashboard → Suscripción → `/[slug]/dashboard/suscripcion/pagar?plan=<id>` with the same card form as the shop (`components/pagos/formulario-tarjeta.tsx`, also used by `/[slug]/checkout`). `/api/suscripcion/checkout` (`{ idPlan, token }`) creates an **authorized preapproval** with `card_token_id` (no redirect to Mercado Pago, no MP plan; amount from `plan_suscripcion`) and applies it right away with `aplicarPreapproval`. Minimum `MONTO_MINIMO_SUSCRIPCION` = $950 CLP (`lib/planes.ts`). Cancel: `/api/suscripcion/cancelar`. Charges are also pulled from Mercado Pago with `sincronizarCobros` (`lib/suscripcion.ts`) right after subscribing and whenever Dashboard → Suscripción opens, as a fallback for the webhook (which never reaches localhost). The webhook handles `subscription_preapproval` and `subscription_authorized_payment` via `lib/suscripcion.ts` (authorized → activa with the chosen plan; each approved charge extends `fecha_termino` 1 month + 5 days and records a `pago` with concepto `suscripcion`; cancelled → no renewal, valid until `fecha_termino`).

### Payments (MercadoPago)
Shop orders are paid with **Checkout API via Orders API** (card form on the site, 1 cuota). App "Sunwalk" (id `7953152967472826`, MLC); subscriptions use the same app.
- `POST /api/checkout` — creates `pedido` + `detalle_pedido` (DB sets prices and deducts stock); body includes `barberia` (slug); returns `{ pedido, monto }` (`monto` = DB total). If stock fails, the order is cancelled (stock returned)
- `/[slug]/checkout` — one page: delivery, address, summary and the card form (MercadoPago.js v2 `cardForm` with `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`; the `issuer`/`installments`/`identificationType` selects must stay in the DOM, hidden). The pedido is created only on "Pagar" (`/api/checkout`, then `/api/checkout/pagar`); a rejected payment reuses it on retry, a changed delivery/address cancels it and creates a new one, and if the DB total differs from the cart total it stops before charging and shows the new total
- `POST /api/checkout/pagar` — `{ barberia, pedido, token, paymentMethodId, paymentMethodType }`; creates an `Order` (`type: online`, `processing_mode: automatic`, `external_reference` = id_pedido, amount from `pedido.monto_total` as an integer string — CLP has no decimals, `"15990.00"` is rejected with 400 —, `installments: 1`, payer = session email) and records it with `registrarPagoOrder` (`lib/pago-pedido.ts`). Every attempt is a new MP order / `pago` row (`id_transaccion_externa` = `ORD…`); a rejected attempt leaves the pedido `pendiente` so the buyer can retry. HTTP 402 = order created but payment failed
- `POST /api/webhooks/mercadopago` — verifies the signature with the SDK `WebhookSignatureValidator` (`data.id` from the query, lowercased) against `MERCADOPAGO_WEBHOOK_SECRET` or `MERCADOPAGO_WEBHOOK_SECRET_ANTERIOR` (old app, for preapprovals created before the switch); handles `order` (upserts `pago`; trigger `aplicar_pago_a_pedido` updates `pedido.estado_pago` and moves paid orders to `confirmado`), `payment` (old Checkout Pro orders) and the subscription topics
- Testing: with test credentials the payer must be a **test buyer user** (Orders API 422; preapproval "Both payer and collector must be real or test users") — set `MERCADOPAGO_TEST_PAYER_EMAIL`, used by `/api/checkout/pagar` and `/api/suscripcion/checkout` (never in production). Test card holder name `APRO` approves, `FUND` = insufficient funds. Chile test cards (official list, Oct 2026; expiry 11/30): credit Mastercard `5416 7526 0258 2580` (CVV 123), credit Visa `4998 4704 7065 8262` (CVV 123), credit Amex `3757 781744 61804` (CVV 1234), debit Mastercard `5597 7917 5464 0466` (CVV 123). The old numbers (Visa `4168 8188 4444 7115`, debit Visa `4023 6535 2391 4373`, debit Mastercard `5241 0198 2664 6950`) are no longer valid. For **subscriptions** use a credit card: debit cards are rejected (`CC_VAL_433`), and the Mastercard has an optional CVV, so its browser token comes without CVV (`Card token was generated without cvv validation`); Amex and the Visa are confirmed to work. These cards are shared by every developer, so a card can come back `max_attempts_exceeded` on its first use: switch cards. After several failed attempts Mercado Pago blocks a test card for a while (`max_attempts_exceeded` in `pago.detalle.payment_status_detail`): alternate cards or wait. In dev, do a full reload after editing `formulario-tarjeta.tsx` (the CardForm mounts once)

### Key Conventions
- **Dates**: Bookings are `timestamptz`. Convert with `lib/datetime.ts` (`toZoned`, `fromZoned`, `todayIn`) using the sucursal timezone (`America/Santiago`) — the server runs in UTC. For dates picked in a calendar use `localDateString()`; never `.toISOString()` for a calendar date.
- **UI language**: All user-facing text is in Spanish (es_CL).
- **Toasts**: `sonner` (`<Toaster />` in root layout). Import `toast` from `"sonner"`.
- **Accessibility**: each page marks its main content `<main id="contenido">` (target of the "Saltar al contenido" link in `app/layout.tsx`). Use `<Button asChild><Link/></Button>`, never a `<Button>` inside a `<Link>`. Every input needs a `<Label htmlFor>`.
- **Dark mode**: `next-themes` with `ThemeProvider`. Background gradient pattern: `from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black`.
- **Soft deletes**: Products and services use `activo: false` for archiving rather than hard deletes, to preserve sales/booking history. `getActive*` functions filter on `activo != false`.

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY   # Checkout API card form
MERCADOPAGO_WEBHOOK_SECRET_ANTERIOR  # optional: old app's secret during the transition
MERCADOPAGO_TEST_PAYER_EMAIL         # optional, testing only: test buyer user's email
BOOKING_SECRET            # signs email links
RESEND_API_KEY, EMAIL_FROM # sender address; the name shown is each barbería's
NEXT_PUBLIC_SITE_URL      # base URL for email links and MercadoPago return URLs
```

### Remote Patterns
Supabase Storage images are served from the current project (host taken from `NEXT_PUBLIC_SUPABASE_URL`) and the old `iuhmjpqwkueueakybgaz.supabase.co` (logos) — configured in `next.config.ts`. Bucket `imgs`: `productos/<id_barberia>/` and `barberias/<id_barberia>/` (logo, galería) — only that barbería's admin can write; `avatars/<user-id>-*` (owner). Barbería logos and gallery are rendered with `<img>` (any host).

Instead of avoiding RLS Policy issues find a fix for them and implement it after asking for permission.
