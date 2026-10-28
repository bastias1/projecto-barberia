# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (who pays): barbershop owners**, with equal weight from the barber who works alone or runs 1–4 chairs (today booking through WhatsApp/Instagram) up to small chains with several barbers and 2+ branches. They sign up at `/registro`, pick a plan, and run the shop from the dashboard, often from a phone between cuts.

**Staff: barbers (`profesional`)** create their own account and join a barbershop by invitation. They use the dashboard to manage their agenda, hours, services and clients during the workday.

**End clients** book appointments, buy products and leave reviews on each barbershop's page, mostly from a phone and often as guests with no account.

**Platform administrators (`superadmin`)** run the `/admin` panel: barbershops, plans, subscriptions, users and the audit log.

## Product Purpose

Navaja ("Agenda online, tienda y gestión para barberías") is a multi-tenant SaaS that gives every barbershop its own page at `/<slug>`, with 24/7 online booking, a shop with Mercado Pago payment, verified reviews and a staff dashboard. It replaces booking by message or phone call and the walk-in-only shop.

Success for the owner means a full agenda, fewer no-shows (email confirm/cancel links) and extra product revenue. Success for the client means booking a barber, service and time from the phone in under a minute, with no account required.

## Positioning

Each barbershop gets **its own full page plus a shop**, not just a booking widget or a listing inside a marketplace. The page carries the shop's logo, gallery, slogan, branches with map and hours, barbers, public reviews and an online store paid with Mercado Pago. The barbershop's brand is in front; Navaja is the infrastructure behind it.

## Operating Context

- Chile-first: prices in CLP (no decimals), timezone `America/Santiago`, Mercado Pago (Checkout API card form, subscriptions via preapproval), UI in Chilean Spanish (es_CL). Started as the site of Barbería BENJVMIN (Valdivia), which is now one tenant at `/benjvmin`.
- Owner journey: landing `/` → signup → `/registro` (14-day trial, no credit card) → dashboard → share link → invite team → set hours per branch → receive bookings.
- Client journey: `/<slug>` → `agendar` (branch → barber → service → time) → email with confirm/cancel links → appointment → email asking for a review. The shop journey is `tienda` → cart → checkout → card payment on-site.
- Staff dashboard: Citas (week/month agenda, realtime toasts for new or cancelled bookings, manual booking), Clientes (history, blocking), Servicios, Horarios, Equipo, Productos/Pedidos (admin + ecommerce module), Estadísticas (bi module), Mi Barbería (public page content, branches), Suscripción.
- Transactional email via Resend; each email is sent with the barbershop's name, reply-to set to the barbershop.
- Light and dark mode, following the system.

## Capabilities and Constraints

- Plans (from `plan_suscripcion`, editable in `/admin`): Básico $19.990, Pro $34.990, Premium $49.990 CLP/month; the middle plan is highlighted as "Más elegido". Plans gate modules (`agenda`, `ecommerce`, `bi`) and limits (e.g. `max_profesionales`). Without a module, its UI is hidden and replaced by a "not available" state.
- Roles are per barbershop (`admin`, `profesional`, `cliente`); the same person can be admin in one and client in another.
- Business rules live in the database (prices, totals, stock, booking validation, plan limits). The UI must not duplicate or contradict them.
- Guest booking: clients can book without an account; clients can be blocked per barbershop.
- Reviews only from completed bookings or delivered orders.
- Barbershop-supplied content (logo, dark-mode logo, gallery, slogan, description, Instagram) varies in quality and may be missing; tenant pages must work with sparse content.
- Stack (existing): Next.js 16 App Router, TypeScript, Supabase, Tailwind v4, shadcn/ui, Zustand, Mercado Pago, Resend; deployed on Vercel.
- Open: the product name "Navaja" is set in `lib/plataforma.ts` and documented as changeable; the contact email is `contacto@navaja.cl`.

## Brand Commitments

- Name: **Navaja** (platform brand; single source in `lib/plataforma.ts`).
- Voice: direct, plain Chilean Spanish, addressed to the owner as "tú" ("Tu barbería, con agenda y tienda en línea", "Planes simples, sin letra chica"). No jargon, no hype.
- On tenant pages the barbershop's own identity (name, logo, gallery) leads. Navaja stays secondary there.

## Evidence on Hand

- **No public evidence yet.** The data in the database (4 barbershops, ~700 bookings, 155 reviews) is test data or not authorized for publication. BENJVMIN may not be shown as a case study, and its reviews may not be quoted, without new confirmation.
- Do not invent testimonials, customer logos, booking counts, ratings, "trusted by" claims or growth figures.
- Real factual claims that can be used: 14-day free trial, no credit card to start, the three plan prices (read live from the DB, not hardcoded), the feature set listed above.

## Product Principles

1. **The barbershop's brand comes first.** Tenant pages present the shop, not the software. Navaja's identity belongs on the platform surfaces (`/`, `/registro`, `/cuenta`, `/admin`).
2. **Booking from a phone, in under a minute.** The client flow is mobile-first, works for guests, and never asks for more than it needs.
3. **The owner runs the shop from their phone.** The dashboard has to work at mobile width during a working day, not only on a desktop.
4. **Honest and simple.** Clear CLP prices, no fine print, no fabricated proof. The copy describes what the product actually does.
5. **The database is the source of truth.** Plans, modules, prices and limits come from the DB, so the UI reflects them rather than hardcoding them.
