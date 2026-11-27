# Cuenta por secciones

Status: ready-for-agent
HU: HU-21 (cuenta de cliente), HU-22 (cancelar / reprogramar), HU-17 (eliminar barbería), HU-01 de invitaciones
Decided in a grilling session on 2026-11-26. Terms: see **Cuenta** and **Compra** in `GLOSSARY.md`.

## Problem

`/cuenta` is one ~200-line page (`app/cuenta/page.tsx`): admin link, invitations, my barberías, bookings, compras, profile, addresses, register-a-barbería, change password, logout. It runs 6 queries on every visit, nothing can be linked to directly, and it has no `<main id="contenido">`.

## Goal

The same features split into one route per section under a shared layout, with a nicer UI in the platform's look. No new features except the ones listed under **Additions**.

## Routes

| Route | Nav label | Content |
|---|---|---|
| `/cuenta` | Resumen | Overview (see below) |
| `/cuenta/perfil` | Perfil | `AvatarUpload` + `ProfileForm` (name, phone, email change via `CambiarCorreo`) |
| `/cuenta/reservas` | Reservas | Próximas + Anteriores (see below) |
| `/cuenta/compras` | Compras | `HistorialPedidos`, polished |
| `/cuenta/direcciones` | Direcciones | `AddressManager` |
| `/cuenta/barberias` | Barberías | Pending invitations, memberships (staff → "Ir al dashboard", client → "Ver página"), suspended barberías the user owns, `EliminarBarberia` for owned ones, "¿Tienes tu propia barbería?" → `/registro` |
| `/cuenta/clave` | Seguridad | `ClaveForm` + `CerrarSesion` at the bottom |
| `/admin` | Panel de la plataforma | Nav link only, superadmin only |

All sections always show in the nav (stable nav); each has an empty state with a useful link (Reservas / Compras → `/barberias`, Barberías → `/registro`).

## Layout and session

- Put the sections in a route group `app/cuenta/(secciones)/` with its `layout.tsx`. `app/cuenta/terminos` and `app/cuenta/correo` stay **outside** the group: they keep their own centered standalone shell (terminos is a consent gate; the user must not wander off it).
- The layout reads the session (`getUser`) and **never redirects**. Signed in: `HeaderPlataforma simple`, the nav, and `<main id="contenido">` around the page. Signed out: just the page (only `/cuenta/clave?token_hash=…` reaches this, from a recovery link in another browser).
- Each section page checks the session itself: `if (!user) redirect("/login?next=/cuenta/<section>")`. `/cuenta/clave` keeps its current rule (no session and no `token_hash` → login).
- Nav: left sidebar on desktop (`md:` and up), horizontally scrollable tab strip on mobile; active item from `usePathname()`, marked with `aria-current="page"`. Superadmin flag for the "Panel de la plataforma" link comes from `resolverAcceso` (already returns `esSuperadmin`), or a cheaper read of `usuario.rol`.
- `ClaveForm` renders its full-screen centered shell only when there is no session; with a session it renders as a section (no outer `min-h-screen` wrapper, no "Mi cuenta" back link: the nav covers it).
- URLs `/cuenta/clave` and `/cuenta/correo` must not change: the Supabase email templates link to them.

## Resumen (`/cuenta`)

Heading "Hola, <nombre>" + email. Then, each block hidden when empty, in this order:

1. Pending invitations, with `ResponderInvitacion` (accept / reject inline).
2. Next booking: the soonest future one in `pendiente`/`confirmada`, with "Cambiar la hora" and "Cancelar" (same rules as Reservas).
3. Latest compra not yet `entregado` or `cancelado`, linking to `/cuenta/compras`.
4. Shortcut cards to the sections.

With no invitation, booking or compra: a welcome card linking to `/barberias`.

Queries: only what these blocks need (invitations, `mis_reservas`, one pedido). The shared queries between Resumen, Reservas and Barberías go in one place (e.g. `lib/cuenta.ts`), not copied per page.

## Reservas (`/cuenta/reservas`)

- Data: RPC `mis_reservas` (max 200, newest first). Keep the cap; add `// shortcut: mis_reservas caps at 200, paginate if a client ever gets close`.
- **Próximas**: `modificable` rows (barbería active, `pendiente`/`confirmada`, start in the future), soonest first, with "Cambiar la hora" (`/<slug>/reprogramar?id=`) and "Cancelar" (AlertDialog → `cambiarReserva`). Keep "Cambios hasta X antes".
- **Anteriores**: the rest, newest first; `cancelada` / `no_asistio` dimmed. "Reservar de nuevo" → `/<slug>/agendar?sucursal=<sucursal slug>` when the barbería is active. Plain link, no barber/service prefill (see `.scratch/recordatorio-volver-a-reservar/`). `mis_reservas` returns `id_sucursal` and the name, not the branch slug: add the slug to the RPC (propose the DB change and ask first) or link to `/<slug>/agendar` without `?sucursal`.
- Drop the inner `max-h-[32rem]` scroll box: the page scrolls.

## Compras (`/cuenta/compras`)

- Same query as today (`pedido` filtered by `id_cliente`, limit 100). Keep the "Ver" dialog.
- Row: first product's photo instead of the generic box icon, amounts with `formatCLP`, dates with the `lib/datetime.ts` helpers. Drop the inner scroll box.

## Additions

- Profile photo in Perfil, reusing `components/dashboard/avatar-upload.tsx` (`userId`, `currentImage`, `userName`).
- "Reservar de nuevo" link (above).
- `<main id="contenido">` (from the layout).

## Callers to update

- `app/[slug]/(publico)/checkout/success/page.tsx`: "Ver mis pedidos" → `/cuenta/compras`.
- `components/dashboard/profile-form.tsx`: "Se cambia en Mi cuenta" → `/cuenta/perfil`.
- `app/cuenta/actions.ts` (`eliminarBarberia`): `revalidatePath("/cuenta")` → `revalidatePath("/cuenta", "layout")` so `/cuenta/barberias` refreshes too.
- `CLAUDE.md` § Role-Based Routing: the "/cuenta is the only account page" paragraph.
- Links that stay `/cuenta` (Resumen is still the landing): login/`resolverAcceso`, signup, `/invitacion`, terms, `correo`, header menus, `next.config.ts` `/profile` redirects. Point the `/profile` redirects at `/cuenta/perfil`.

## Look

Platform look (`components/plataforma/`, `--brand`, `display` titles), no barbería Apariencia even when arriving from a barbería menu. Each page: `display` title + one-line description, content in `Card`s, real empty states. Semantic tokens only.

## Out of scope

- The staff profile in the dashboard (`components/dashboard/profile-form.tsx`), other than its link.
- Prefilling `agendar` with barber and service; the rebooking reminder.
- Deleting your own account (stays a request via `/eliminar-datos`).
- Pagination of bookings or compras.

## Checks

- Signed out: every section → `/login?next=<that path>`; `/cuenta/clave?token_hash=x` renders bare without the nav; `/cuenta/terminos` and `/cuenta/correo` never show the nav.
- Superadmin sees "Panel de la plataforma"; a client does not.
- Cancel a booking from Resumen and from Reservas → it moves to Anteriores after refresh.
- Delete an owned barbería from Barberías → the list updates.
- Mobile width (375px): tab strip scrolls, no horizontal page scroll.
- `pnpm lint` and `pnpm build` pass.
