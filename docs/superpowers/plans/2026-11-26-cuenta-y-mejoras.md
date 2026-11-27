# Cuenta, autenticación, prueba gratis y UI: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Track steps with `- [ ]`. First step after approval: copy this file to `docs/superpowers/plans/2026-11-26-cuenta-y-mejoras.md`.

**Goal:** Ship the 11 requested changes on `feat/mejoras-menores`, with `/cuenta` as the only account page.

**Architecture:** Four independently shippable chunks (A UI, B account, C auth, D ownership/trial/delete). Rules live in the database (RPCs, triggers); pages stay thin.

**Tech stack:** Next.js 16, TypeScript, Supabase, shadcn/ui, Vitest.

**Spec:** the request, `Requerimientos.md` (HU-17, HU-18, HU-21, HU-22) and the decisions below.

## Context

`/<slug>/profile` duplicates `/cuenta`; trials are unlimited; there is no way to delete a barbershop or change email; several screens need polish.

**Urgent, found while planning (confirmed in production):** `cambiar_reserva_cliente` lets any signed-in user cancel or reschedule **any guest booking**. For a guest row `r.id_cliente = auth.uid()` is NULL, so the `IF NOT (...)` guard never raises. Task 0 fixes it.

## Decisions (answered by you)

- Delete = **soft delete**, allowed only to the **creator**.
- **One free 14-day trial per account, Pro only.** Any other plan, or a later barbershop, starts unpaid.
- Guest bookings made with the account's email are listed **and** can be cancelled/rescheduled.

## Global constraints

- UI text in Spanish (es_CL), semantic tokens, `<main id="contenido">`, `<Label htmlFor>` on inputs.
- Commits reference the HU: `feat(HU-21): ...`.
- Each migration: apply to the **test** project first, then production only after you confirm; mirror in `DB.sql` and `lib/database.types.ts`; update `CLAUDE.md`.
- Production shares the DB with the deployed `master`. Apply the chunk D migration at merge time (it changes registration behaviour immediately).
- Approving this plan approves these permission changes: Task 0, the `barberia` protection trigger (D1), and guest access by confirmed email (B1).
- Trial plan is data (`es_plan_prueba`), never `id_plan = 2`.

## Review focus

1. A signed-in stranger changes someone else's guest booking → rejected (Task 0).
2. Account with unconfirmed email → sees and changes no guest bookings (B1).
3. Mercado Pago refuses to cancel during delete → nothing is deleted (D3).
4. Two registrations at once from one account → exactly one trial (D2).
5. Google-only account (no password) → can still set one without a "current password" (C2).

---

## Task 0: Close the guest-booking hole (HU-22) — do first

**Files:** migration; `DB.sql:2102`; Create `tests/cambio-reserva.test.ts` (seed with `tests/helpers/semilla-bi.ts`).

- [ ] Test `un usuario ajeno no puede cancelar la reserva de un invitado`: RPC as an unrelated user returns error code `42501` and `estado` stays unchanged. Run `pnpm test cambio-reserva` → FAIL.
- [ ] Replace the guard with `IF NOT FOUND OR NOT coalesce(auth.role() = 'service_role' OR r.id_cliente = auth.uid(), false) THEN`.
- [ ] Re-run → PASS. Apply to production after your OK. Commit `fix(HU-22): un usuario no puede modificar reservas de invitados ajenos`.

---

## Chunk A: UI fixes

### A1. Admin panel (HU-20)
**Files:** `app/admin/layout.tsx`, `app/admin/barberias/[id]/page.tsx:35-80`.
- [ ] Header link "Volver al inicio" → `/`.
- [ ] Under the name keep only title, badge and `/slug`. New `Card` "Administrador": each admin's nombre, email, teléfono (add `telefono` to the existing query), plus the barbershop's `email_contacto`, `telefono` and registration date.
- [ ] Check in the browser; commit.

### A2. Volver on `/[slug]/agendar` (HU-02)
**Files:** `app/[slug]/(publico)/agendar/page.tsx:354-380`.
- [ ] On the first step (Sucursal, or Barbero when there is one branch) pass `onBack` to `AccionesPaso` → `router.push(href("/"))`.
- [ ] Check both one-branch and multi-branch; commit.

### A3. shadcn date picker (HU-02)
**Files:** `components/booking/date-time-selection.tsx:57-75` only. Do **not** edit `components/ui/calendar.tsx` (dashboard shares it). Props unchanged.
- [ ] Popover + Calendar, same pattern as `components/dashboard/nueva-cita-dialog.tsx:193-211`: full-width `h-12` trigger with calendar icon, selected date or "Elige una fecha", `es` locale, Monday first, same `disabled` matchers, closes on select.
- [ ] Verify agendar and reprogramar, mobile and desktop, light, dark and a fixed-mode barbershop theme. Commit.

---

## Chunk B: `/cuenta` is the only account page

### B1. Booking history in the database (HU-21, HU-22)
**Files:** migration; `DB.sql`; `lib/database.types.ts`; `tests/cambio-reserva.test.ts`.

**Produces:**
- `private.es_mi_invitado(p_guest uuid) RETURNS boolean`: true only when `auth.users.email_confirmed_at` is set and the guest's `correo` equals that email (case-insensitive).
- `public.mis_reservas(p_reserva bigint DEFAULT NULL)`, SECURITY DEFINER, `authenticated` only. Rows where `id_cliente = auth.uid()` or `es_mi_invitado(id_guest)`, newest first, max 200 (`shortcut:` comment). Columns: `id_reserva, fecha_hora_inicio, estado, monto, es_invitado, id_barberia, barberia, slug, barberia_activa, plazo_cancelacion_min, id_sucursal, sucursal, zona_horaria, id_profesional, barbero, id_servicio, servicio, servicio_precio, duracion_min`.
- `cambiar_reserva_cliente` also authorizes `private.es_mi_invitado(r.id_guest)`.

- [ ] Tests: confirmed user lists and cancels a guest booking with their email; unconfirmed user gets neither; another user gets neither. FAIL → implement → PASS. Commit.

### B2. History UI and cards (HU-21)
**Files:** `app/cuenta/page.tsx`; Create `components/cuenta/historial-reservas.tsx`, `components/cuenta/historial-pedidos.tsx` (adapt `components/profile/booking-history.tsx`, `order-history.tsx`); `app/[slug]/(publico)/reprogramar/page.tsx`.

- [ ] Reservas from `mis_reservas()`, each showing barbershop name; cancel via existing `cambiarReserva`; reschedule links to `/<slug>/reprogramar?id=`. No actions when `barberia_activa` is false.
- [ ] Pedidos: `pedido` filtered by `id_cliente = user.id` across barbershops (keep the filter: staff RLS returns others' rows). Missing name → "Barbería no disponible". Keep the detail dialog.
- [ ] Each history card renders only if it has rows.
- [ ] `/reprogramar` without token: load with `mis_reservas(id)` instead of the `reserva` select (RLS hides guest rows).
- [ ] **Bug fix:** the invitations query adds `.eq("correo", user.email.toLowerCase())`. Today admins and superadmins also get other people's invitations.
- [ ] Render Invitaciones only if there are some; "Mis barberías" only if there are memberships.
- [ ] Browser check with an empty account and one with history. Commit.

### B3. Addresses on `/cuenta` (HU-23)
**Files:** `app/cuenta/page.tsx`; move `components/profile/address-manager.tsx` into use there.
- [ ] Add the card; link the region/comuna labels to their selects.
- [ ] Add an address, confirm it appears in a second barbershop's checkout (same `direccion_usuario` table). Commit.

### B4. Remove `/<slug>/profile`
**Files:** delete `app/[slug]/(publico)/profile/`, `components/profile/{booking-history,order-history,password-form}.tsx`; `next.config.ts`, `components/barberia-user-menu.tsx:116`, `app/[slug]/(publico)/checkout/success/page.tsx:92`, `lib/staff-context.ts:84`, `CLAUDE.md`.
- [ ] Remove `'profile'` from `RUTAS_ANTIGUAS`; add redirects `/profile` and `/:slug/profile` → `/cuenta`.
- [ ] Point the three links to `/cuenta` (menu label "Mi cuenta"). Keep `profile` as a reserved slug.
- [ ] `pnpm build`; grep `/profile` leaves only `/api/profile`, reserved slugs and redirects. Commit.

---

## Chunk C: Password and email (HU-21)

### C1. Upgrade supabase-js
- [ ] 2.98.0 → latest 2.x (needs ≥ 2.102 for the current-password option); check `@supabase/ssr` compatibility. `pnpm build && pnpm test` PASS. Commit.

### C2. Current password
**Files:** migration; `app/cuenta/clave/{page,clave-form}.tsx`; `components/dashboard/password-form.tsx`; `tests/clave.test.ts`.
**Produces:** `public.tengo_clave() RETURNS boolean` (SECURITY DEFINER, `auth.users.encrypted_password` non-empty for `auth.uid()`).

- [ ] Test: wrong current password → `updateUser` errors; right one → succeeds. (Requires the dashboard setting below on the test project.)
- [ ] Field "Contraseña actual" shown when `tengo_clave()` and there is no `token_hash`; sent as the current-password attribute of `updateUser` (take the exact name from the upgraded types). Recovery flow unchanged.
- [ ] Dashboard password form → link to `/cuenta/clave`, so it can't skip the check.
- [ ] Verify three paths: password account, Google-only account, recovery email. Commit.

### C3. Email change
**Files:** `components/profile/profile-form.tsx:105-109`; Create `app/cuenta/correo/page.tsx` (public, no session required); `supabase/templates/cambio-correo.html`; `components/dashboard/profile-form.tsx` (remove email field, link to `/cuenta`).

- [ ] "Cambiar correo": `updateUser({ email }, { emailRedirectTo: `${origin}/cuenta/correo` })`, then `avisarCambioSeguridad("correo")`; message says to confirm by email.
- [ ] Template link: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email_change` (same pattern as `recuperar-clave.html`).
- [ ] Page: a button runs `verifyOtp({ type: "email_change", token_hash })` (never on GET). With no session returned, say the other inbox must also confirm.
- [ ] Verify end to end with two real inboxes, both links. Commit.

Note: after changing email, guest bookings made under the old address drop out of history (account bookings stay).

---

## Chunk D: Owner, free trial, delete (HU-17, HU-18)

### D1. Owner column and protection
**Files:** migration; `DB.sql`; `lib/database.types.ts`.
**Produces:** `barberia.id_propietario uuid` (FK `usuario`, backfilled with the oldest admin by `usuario_barberia.created_at`), `barberia.eliminada_at timestamptz`; trigger `proteger_barberia`: changes to `activa`, `id_propietario`, `eliminada_at` only by superadmin, service role or direct SQL. A trigger, not a grant revoke, because the superadmin updates `activa` with their own session.

- [ ] Test: barbershop admin updating `activa` → `42501` (today a suspended shop can likely reactivate itself); superadmin suspend still works.
- [ ] Add the "Propietario" badge to the A1 card. Commit.

### D2. One Pro trial per account
**Files:** migration; `DB.sql:1966-2001`; `app/registro/{page,actions}.tsx|ts`; `components/registro/registro-form.tsx`; `lib/planes.ts`; `lib/notifications.ts:340`; `tests/helpers/semilla-bi.ts:34`, `tests/google-calendar{,-sync}.test.ts`; Create `tests/prueba-gratis.test.ts`.
**Produces:** `plan_suscripcion.es_plan_prueba boolean` (unique partial index; set on Pro), `usuario.prueba_usada_at timestamptz` (no column grant; backfilled from owned barbershops). `registrar_barberia` signature unchanged and sets `id_propietario`.

Algorithm:
1. Claim atomically, only for the trial plan: `UPDATE usuario SET prueba_usada_at = now() WHERE id_usuario = v_usuario AND prueba_usada_at IS NULL AND <plan es_plan_prueba>`.
2. Insert the subscription as `prueba` (hoy + 14), then the sucursal.
3. If the claim failed, **then** set it to `estado = 'vencida', fecha_termino = hoy_chile()`. Order matters: with no active subscription `barberia_limite` returns 0 and the sucursal insert fails.

- [ ] Tests first: first Pro → `prueba`; second Pro → `vencida` with its sucursal created; first Básico → `vencida` and the trial still available; two concurrent calls → one `prueba`.
- [ ] Test helpers set the subscription to `activa` with the service-role client after registering (test users are reused, so otherwise every second run fails).
- [ ] App: without trial, redirect to `/<slug>/dashboard/suscripcion/pagar?plan=<id>`; `/registro` preselects the trial plan and says "14 días gratis" only for it; welcome email takes a `conPrueba` flag.
- [ ] Copy: `app/registro/page.tsx:37`, `app/page.tsx:60,150`, `app/cuenta/page.tsx:128`, `components/plataforma/{header,menu-movil}.tsx`, terms and refunds pages (bump `VERSION_POLITICA`).
- [ ] `pnpm test` twice in a row → PASS. Commit.

The flag has no editor in `/admin/planes`: archiving the flagged plan turns trials off.

### D3. Delete barbershop
**Files:** migration; Create `lib/eliminar-barberia.ts`, `app/cuenta/actions.ts` (add), `components/cuenta/eliminar-barberia.tsx`, `tests/eliminar-barberia.test.ts`; `app/cuenta/page.tsx`; `app/admin/barberias/*`, `lib/admin-datos.ts`; `CLAUDE.md` (new service-role use).
**Produces:**
- RPC `eliminar_barberia(p_barberia uuid, p_usuario uuid) RETURNS SETOF bigint` (service role only). Rejects non-owner (`42501`) and paid, undelivered orders (`PEDIDOS_PENDIENTES`). Sets `activa=false`, `eliminada_at`, slug `eliminada-<uuid sin guiones>`; cancels future bookings (returns their ids) and pending invitations; deactivates memberships and `profesional` rows. Deletes no rows.
- `eliminarBarberiaDe(admin, { idBarberia, idUsuario }, opts?: OpcionesSuscripcion): Promise<ResultadoAccion>`, in this order: check owner and pending orders → cancel Mercado Pago with `eliminarSuscripcion` (only if there is a live subscription; **abort on failure**) → `mp_borrar` → RPC → `notificarCambioReserva(id, "cancelada")` per booking.

- [ ] Tests: non-owner rejected; MP refusal leaves everything intact; pending paid order blocks; success keeps bookings/payments, frees the slug, and a re-registration gets no new trial.
- [ ] UI: "Eliminar" in "Mis barberías" only for the owner (query by `id_propietario`, `eliminada_at is null`, includes suspended ones); dialog requires typing the name and says it can't be undone from the app.
- [ ] `/admin`: "Eliminada" badge; hide its subscription and suspend actions.
- [ ] Browser check; commit.

---

## Manual steps for you (dashboard, I can't do them)

Do these on production and the test project:
- Authentication → require current password when updating password.
- Confirm email stays **required** at signup (guest history depends on it).
- Note whether "Secure email change" is on (two confirmation emails).
- Paste the new `cambio-correo.html` template; add `<site>/cuenta/correo` to Redirect URLs.

## Verification

`pnpm lint`, `pnpm test` (twice), `pnpm build`; then browser walk-through: register two barbershops with one account, delete one, `/cuenta` empty and full, password and email change, agendar on mobile.

## Noticed, not included

- A public **"TEST SUB" plan ($1.000) is active in production** and is preselected on `/registro` (D2 changes the preselection; consider archiving it).
- The payment email prints the delivery address as raw JSON (`lib/notifications.ts:285`).
- Booking calendar hardcodes Sundays as closed.
- No "default address" (the spec asks for one).

## Execution

Recommended: **native** (I implement in this session, one fresh reviewer at the end); tasks are sequential and share files. Alternative: subagent-driven, more review, more cost. Order: Task 0, A, B, C, D.
