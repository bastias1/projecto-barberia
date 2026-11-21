# Sunwalk

> SaaS para barberías: cada barbería tiene su propia página con reservas online, tienda y panel de gestión.

Nació como el sitio de la Barbería BENJVMIN (Valdivia, Chile), hoy en `/benjvmin`. Producción: **https://www.sunwalk.app**

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, Storage, Vault, Realtime) · Tailwind v4 + shadcn/ui · Zustand · Mercado Pago · Resend · Google (login y Calendar) · Vercel.

## Qué incluye

- **Página pública por barbería** (`/<slug>`) y por sucursal (`/<slug>/<sucursal>`).
- **Reserva online** como invitado o con cuenta; cancelar y reprogramar desde el correo o el perfil.
- **Tienda** con carrito y pago con tarjeta (Mercado Pago, Checkout API).
- **Panel** (`/<slug>/dashboard`): citas (día/semana/mes), clientes, servicios, horarios, productos, pedidos, equipo por invitación, estadísticas (BI) y suscripción.
- **Planes de suscripción** con módulos (`agenda`, `ecommerce`, `bi`, `calendario`) y límites que aplica la base de datos.
- **Google Calendar** por barbero (HU-24) e **inicio de sesión con Google**.
- **Panel de plataforma** (`/admin`) para superadministradores.
- **Páginas legales** y eliminación de datos (Ley 21.719).

## Inicio rápido (desarrollo)

Requisitos: Node.js 20+, pnpm, y cuentas en Supabase, Resend, Google Cloud, Mercado Pago y Vercel (estas dos últimas solo si las vas a usar).

```powershell
pnpm install
# crea .env.local con las variables del manual (sección 7)
pnpm dev
```

Abre http://localhost:3000. **La app no funciona sin una base de datos Supabase preparada y sin las variables de entorno**: sigue el [Manual de puesta en marcha](docs/MANUAL.md), que explica todo desde cero (Supabase, Resend, Google, Mercado Pago, Vercel).

## Comandos

```powershell
pnpm dev      # servidor de desarrollo (localhost:3000)
pnpm build    # build de producción
pnpm start    # servidor de producción
pnpm lint     # ESLint
pnpm test     # Vitest (usa un proyecto Supabase DE PRUEBAS, nunca producción)
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/MANUAL.md](docs/MANUAL.md) | Puesta en marcha desde cero: Supabase, Resend, Google, Mercado Pago, Vercel, primer superadmin y verificación |
| [docs/verificacion-google.md](docs/verificacion-google.md) | Verificación de la app de Google (scopes sensibles de Calendar) |
| [supabase/templates/README.md](supabase/templates/README.md) | Plantillas de los correos de Supabase Auth |
| [Requerimientos.md](Requerimientos.md) | Especificación funcional (HU, reglas de negocio, casos de prueba) |
| [CLAUDE.md](CLAUDE.md) | Arquitectura y convenciones del código |

## Estructura

```
app/                 Rutas (App Router): /[slug]/..., /admin, /api, legales
components/          Componentes (dashboard, booking, pagos, ui de shadcn)
lib/                 Lógica compartida y lib/services/ (acceso a datos)
utils/supabase/      Clientes de Supabase (navegador, servidor, service role)
supabase/templates/  Plantillas HTML de los correos de Auth
tests/               Pruebas Vitest contra la base de datos
BDD.SQL RLS.sql BI.sql HU24.sql   Esquema, políticas, funciones y Calendar
proxy.ts             Middleware (re-exporta utils/supabase/middleware.ts)
```

## Reglas importantes

- Toda consulta filtra por `id_barberia`; nunca se fija una barbería a mano.
- Las reglas de negocio (precios, stock, validación de reservas, límites de plan) viven en la base de datos (triggers). Lee el trigger antes de "arreglar" algo en la app.
- `lib/database.types.ts` se mantiene a mano: actualízalo al cambiar el esquema.
- Todo el texto de cara al usuario está en español (es_CL).
- Nunca subas `.env.local` ni claves al repositorio.
