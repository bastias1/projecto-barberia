# Manual de puesta en marcha de Sunwalk

Guía para dejar la aplicación funcionando **desde cero**: base de datos, correos, Google, pagos y despliegue. Sigue los pasos en orden; cada sección termina con una verificación.

## Índice

0. [Visión general y orden recomendado](#0-visión-general-y-orden-recomendado)
1. [Requisitos](#1-requisitos)
2. [Código y dependencias](#2-código-y-dependencias)
3. [Supabase](#3-supabase)
4. [Resend (correos)](#4-resend-correos)
5. [Google Cloud (login y Calendar)](#5-google-cloud-login-y-calendar)
6. [Mercado Pago](#6-mercado-pago)
7. [Variables de entorno](#7-variables-de-entorno)
8. [Ejecutar en local](#8-ejecutar-en-local)
9. [Vercel (producción)](#9-vercel-producción)
10. [Activar la sincronización de Google Calendar (pg_cron)](#10-activar-la-sincronización-de-google-calendar-pg_cron)
11. [Primer superadmin, planes y primera barbería](#11-primer-superadmin-planes-y-primera-barbería)
12. [Pruebas automáticas](#12-pruebas-automáticas)
13. [Lista de verificación final](#13-lista-de-verificación-final)
14. [Problemas frecuentes](#14-problemas-frecuentes)

---

## 0. Visión general y orden recomendado

| Servicio | Para qué se usa |
|---|---|
| **Supabase** | Base de datos Postgres, autenticación, Storage (imágenes), Vault (token de Google), Realtime y `pg_cron` |
| **Resend** | Todo el correo: el de la app (reservas, reseñas, invitaciones) y el de Supabase Auth (confirmación, recuperar clave) vía SMTP |
| **Google Cloud** | Un único cliente OAuth para "Continuar con Google" (vía Supabase) y para vincular Google Calendar |
| **Mercado Pago** | Pago de la tienda (Checkout API / Orders API) y suscripciones de las barberías (preapproval) |
| **Vercel** | Alojamiento de la app Next.js y variables de producción |

Orden recomendado (hay dependencias: Google necesita la URL de Supabase; Mercado Pago y Google necesitan la URL de Vercel):

1. Supabase (proyecto + SQL + Storage) → 2. Resend (dominio + API key + SMTP en Supabase) → 3. Google Cloud → 4. Mercado Pago → 5. `.env.local` y prueba en local → 6. Vercel → 7. Volver a Google/Mercado Pago/Supabase para añadir las URLs de producción → 8. `pg_cron`.

---

## 1. Requisitos

- **Node.js 20.9 o superior** (lo exige Next.js 16) y **pnpm** (`npm install -g pnpm`).
- **Git**.
- Cuentas gratuitas o de pago en: Supabase, Resend, Google Cloud, Mercado Pago (Chile) y Vercel.
- Un **dominio propio** (producción usa `sunwalk.app`). Sin dominio verificado, Resend solo envía a tu propio correo y Google no verifica la app.
- Cuenta de GitHub si despliegas con Vercel desde el repositorio.

## 2. Código y dependencias

```powershell
git clone <URL-del-repositorio> projecto-barberia
cd projecto-barberia
pnpm install
```

> El repositorio trae `package-lock.json` y `pnpm-lock.yaml`; el proyecto usa **pnpm**.

---

## 3. Supabase

### 3.1 Crear el proyecto

1. Entra a https://supabase.com/dashboard → **New project**.
2. Elige nombre, contraseña de base de datos (guárdala) y una región cercana (para Chile: `South America (São Paulo)`).
3. Cuando termine de crearse, anota en **Project Settings → API** (o **API Keys**):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (**secreta**: nunca en el navegador ni en el repositorio).

### 3.2 Extensiones

En **Database → Extensions** activa (si no lo están): `pg_cron`, `pg_net`, `btree_gist`. Supabase Vault ya viene habilitado. `BDD.SQL` intenta crearlas, pero activarlas antes evita errores de permisos.

### 3.3 Crear el esquema (SQL)

En **SQL Editor** ejecuta los archivos del repositorio **en este orden**, cada uno completo (copiar, pegar, *Run*):

| Orden | Archivo | Contenido |
|---|---|---|
| 1 | `BDD.SQL` | Tablas, restricciones, triggers y reglas de negocio. Ya incluye lo de HU-24 (Google Calendar: tablas, cola y job de `pg_cron`, creado **desactivado**) |
| 2 | `RLS.sql` | Políticas de seguridad (RLS), funciones RPC, políticas de Storage y la publicación `supabase_realtime` para `reserva` |
| 3 | `BI.sql` | Funciones `bi_*` de las estadísticas |

> **No ejecutes `HU24.sql` en una base nueva**: es solo la migración para bases que ya existían; en una base nueva su contenido ya está en `BDD.SQL` y `RLS.sql`.

Si un script falla a la mitad, corrige la causa y vuelve a correrlo sobre un proyecto vacío (los scripts no son idempotentes). Recuerda que las reglas de negocio están en la base: no las dupliques en la app.

### 3.4 Storage (imágenes)

Las políticas del bucket están en `RLS.sql`, pero **el bucket se crea a mano**:

1. **Storage → New bucket** → nombre exacto `imgs` → marcar **Public bucket** → crear.
2. Estructura que usa la app (se crea sola al subir): `productos/<id_barberia>/`, `barberias/<id_barberia>/` (logo y galería) y `avatars/<id-usuario>-*`.

### 3.5 Autenticación

En **Authentication**:

**a) URL Configuration**
- **Site URL**: `https://www.sunwalk.app` (en local puedes cambiarla a `http://localhost:3000`, o dejar la de producción y usar la lista de abajo).
- **Redirect URLs** (añade ambas):
  - `https://www.sunwalk.app/**`
  - `http://localhost:3000/**`
  - Si usas previews de Vercel: `https://*-<tu-equipo>.vercel.app/**`

**b) Sign In / Providers**
- **Email**: activo. Deja activada la **confirmación de correo** ("Confirm email"): la app maneja el flujo (`/auth/callback`, y `/login?confirmado=1` si el link se abre en otro navegador).
- **Google**: se configura en la [sección 5](#5-google-cloud-login-y-calendar) (necesita el Client ID y Secret).

**c) SMTP con Resend** (se completa tras la [sección 4](#4-resend-correos))
- **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
  - Sender email: `notificaciones@sunwalk.app` (o el remitente de tu dominio verificado)
  - Sender name: `Sunwalk`
  - Host: `smtp.resend.com` · Port: `465`
  - Username: `resend` · Password: **tu API key de Resend**

**d) Plantillas de correo**
- **Authentication → Emails → Templates**. Pega el HTML de `supabase/templates/` en cada una:

| Plantilla en Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirmacion.html` | Confirma tu correo |
| Reset password | `recuperar-clave.html` | Crea una nueva contraseña |
| Change email address | `cambio-correo.html` | Confirma tu nuevo correo |
| Magic link | `magic-link.html` | Tu link para entrar |

**e) Opcional pero recomendado**: en **Authentication → Rate Limits** revisa los límites de correos por hora cuando uses SMTP propio.

### 3.6 Vault y secretos para el cron

Se hace en la [sección 10](#10-activar-la-sincronización-de-google-calendar-pg_cron), una vez que tengas el sitio desplegado y `CRON_SECRET`.

**Verificación:** en **Table Editor** aparecen las tablas (`barberia`, `reserva`, `plan_suscripcion`, …); en **Storage** existe `imgs`; en **Database → Functions** existen `registrar_barberia` y `bi_ingresos`.

---

## 4. Resend (correos)

Todo el correo sale de Resend con el dominio verificado `sunwalk.app`.

1. Crea la cuenta en https://resend.com.
2. **Domains → Add Domain** → `sunwalk.app` (región cercana, por ejemplo `São Paulo`).
3. Resend muestra los registros DNS. Agrégalos en el proveedor de tu dominio (donde administras el DNS):
   - **SPF** (TXT) y **DKIM** (TXT/CNAME) tal cual los indica Resend.
   - Recomendado: **DMARC** (TXT en `_dmarc`), por ejemplo `v=DMARC1; p=none; rua=mailto:contact@sunwalk.app`.
4. Pulsa **Verify**. Puede tardar de minutos a horas. Espera a ver el dominio en estado **Verified**.
5. **API Keys → Create API Key** con permiso **Sending access** (limitado a ese dominio). Cópiala una sola vez: es `RESEND_API_KEY`.
6. Define el remitente: `EMAIL_FROM="Sunwalk <notificaciones@sunwalk.app>"`. El nombre que ve el cliente es el de cada barbería (lo pone la app) y las respuestas van al `email_contacto` de la barbería (`replyTo`).
7. Usa la misma API key como contraseña SMTP en Supabase (sección 3.5 c).

Comportamiento a tener en cuenta:
- **Sin `RESEND_API_KEY` la app no falla**: omite los correos y escribe los links en la consola del servidor (útil en desarrollo).
- Correos de la app: reserva creada (links de confirmar/cancelar), reserva completada y pedido entregado (link de reseña), invitación de equipo, aviso de stock bajo, cambios de reserva.
- Los links de confirmar/cancelar se firman con `BOOKING_SECRET`; abren una página con un botón (los antivirus de correo no pueden cambiar la reserva con un GET).

**Verificación:** envía un correo de prueba desde Resend; crea una cuenta en la app y comprueba que llega el correo de confirmación con el diseño de `supabase/templates/`.

---

## 5. Google Cloud (login y Calendar)

Se usa **un solo cliente OAuth (Web)** para dos cosas:
- *Continuar con Google* (login, a través de Supabase).
- Vincular Google Calendar de cada barbero (rutas `/api/google-calendar/*`, módulo `calendario`).

### 5.1 Proyecto y API

1. https://console.cloud.google.com → crea un proyecto (ej. `Sunwalk`).
2. **APIs & Services → Library** → habilita **Google Calendar API**.

### 5.2 Pantalla de consentimiento (Google Auth Platform)

1. **Branding**: nombre `Sunwalk`, correo de soporte, logo (120×120 px), página principal `https://www.sunwalk.app`, privacidad `https://www.sunwalk.app/privacidad`, términos `https://www.sunwalk.app/terminos`, dominios autorizados `sunwalk.app` y `supabase.co`.
2. **Audience**: empieza en *Testing* y añade tus correos como **usuarios de prueba**. Para público general debe pasar a *In production* y verificarse (ver [verificacion-google.md](verificacion-google.md): `calendar.events` es un scope sensible; sin verificar hay aviso de "app no verificada" y tope de 100 usuarios).
3. **Data access (scopes)**: agrega solo `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` y `https://www.googleapis.com/auth/calendar.events`.

### 5.3 Credenciales OAuth

**Credentials → Create credentials → OAuth client ID → Web application.** URIs de redirección autorizadas:

| Entorno | URI |
|---|---|
| Login (Supabase) | `https://<tu-proyecto>.supabase.co/auth/v1/callback` |
| Calendar, producción | `https://www.sunwalk.app/api/google-calendar/callback` |
| Calendar, local | `http://localhost:3000/api/google-calendar/callback` |

Recomendación: crea **dos clientes**, "Sunwalk" (producción, sin `localhost`) y "Sunwalk dev" (local); Google rechaza con frecuencia los clientes de producción con URIs de `localhost`.

Copia el **Client ID** y el **Client secret**:
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (Vercel o `.env.local`).
- Los mismos valores en **Supabase → Authentication → Providers → Google** (activar el proveedor, pegar Client ID y Secret, y comprobar que la *Callback URL* mostrada coincide con la registrada arriba).

> Sin `GOOGLE_CLIENT_ID/SECRET` la app sigue funcionando: la tarjeta de Calendar en Configuración muestra una nota en vez del botón "Conectar".

**Verificación:** en `/login` pulsa "Continuar con Google": inicia sesión y, si es una cuenta nueva, aparece `/cuenta/terminos` para aceptar los términos. Más tarde, en Dashboard → Configuración, "Conectar Google Calendar" (requiere un plan con el módulo `calendario`).

---

## 6. Mercado Pago

Necesario solo para la tienda y las suscripciones. App existente: "Sunwalk" (Chile, MLC). Una app nueva se crea en https://www.mercadopago.cl/developers → **Tus integraciones → Crear aplicación**: producto **Checkout API** (tienda) y habilita **Suscripciones**.

### 6.1 Credenciales

En la app → **Credenciales** (pruebas y producción son distintas):
- **Access Token** → `MERCADOPAGO_ACCESS_TOKEN` (secreto).
- **Public Key** → `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (la usa el formulario de tarjeta del navegador).

### 6.2 Webhook

En la app → **Webhooks (Notificaciones)**:
- URL (producción): `https://www.sunwalk.app/api/webhooks/mercadopago`
- Eventos: **Order** (`order`), **Payments** (`payment`), **Planes y suscripciones** (`subscription_preapproval` y `subscription_authorized_payment`).
- Copia la **clave secreta** que entrega → `MERCADOPAGO_WEBHOOK_SECRET`. La ruta valida la firma HMAC con ese secreto.
- `MERCADOPAGO_WEBHOOK_SECRET_ANTERIOR` es opcional: el secreto de una app anterior mientras existan suscripciones creadas con ella.
- El webhook **nunca llega a `localhost`**; en local la app consulta a Mercado Pago directamente (`sincronizarCobros`) al abrir Dashboard → Suscripción y tras pagar.

### 6.3 Pruebas (credenciales de prueba)

- El comprador debe ser un **usuario de prueba**. Define su correo en `MERCADOPAGO_TEST_PAYER_EMAIL` (**solo para pruebas, jamás en producción**).
- Nombre del titular `APRO` aprueba el pago; `FUND` = fondos insuficientes.
- Tarjetas de prueba de Chile (vencimiento 11/30):
  - Crédito Mastercard `5416 7526 0258 2580` (CVV 123)
  - Crédito Visa `4998 4704 7065 8262` (CVV 123)
  - Crédito Amex `3757 781744 61804` (CVV 1234)
  - Débito Mastercard `5597 7917 5464 0466` (CVV 123)
- Para **suscripciones** usa **tarjeta de crédito** (la de débito se rechaza). Si una tarjeta devuelve `max_attempts_exceeded`, cambia de tarjeta o espera.
- Monto mínimo de suscripción: **$950 CLP**.
- Tras editar `components/pagos/formulario-tarjeta.tsx` recarga la página por completo (el formulario se monta una vez).

**Verificación:** compra un producto en `/<slug>/tienda` con la tarjeta de prueba; el pedido pasa a `pagado`/`confirmado` y se descuenta el stock.

---

## 7. Variables de entorno

Crea el archivo `.env.local` en la raíz (no se sube a Git). Para producción, las mismas variables (con valores de producción) van en Vercel.

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service_role/secret key>

# --- Sitio ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000        # en producción: https://www.sunwalk.app
BOOKING_SECRET=<cadena aleatoria larga>            # firma los links de correo
CRON_SECRET=<otra cadena aleatoria larga>          # protege /api/google-calendar/sincronizar

# --- Resend ---
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="Sunwalk <notificaciones@sunwalk.app>"

# --- Google (login + Calendar) ---
GOOGLE_CLIENT_ID=<...>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<...>

# --- Mercado Pago ---
MERCADOPAGO_ACCESS_TOKEN=<access token>
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=<public key>
MERCADOPAGO_WEBHOOK_SECRET=<clave secreta del webhook>
# Opcionales:
# MERCADOPAGO_WEBHOOK_SECRET_ANTERIOR=<secreto de la app anterior>
# MERCADOPAGO_TEST_PAYER_EMAIL=<correo del comprador de prueba>   # SOLO pruebas
```

Genera secretos aleatorios (`BOOKING_SECRET`, `CRON_SECRET`) con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Resumen de qué es obligatorio:

| Variable | ¿Obligatoria? | Si falta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Sí | La app no funciona |
| `NEXT_PUBLIC_SITE_URL` | Sí en producción | Los links de correo y retornos de pago usan una URL equivocada |
| `BOOKING_SECRET` | Sí | Los links de confirmar/cancelar no se pueden firmar |
| `RESEND_API_KEY`, `EMAIL_FROM` | Recomendado | No se envían correos (los links salen en la consola) |
| `GOOGLE_CLIENT_ID/SECRET` | Opcional | Se oculta "Conectar" de Calendar |
| `CRON_SECRET` | Con Calendar | La sincronización responde 401 |
| `MERCADOPAGO_*` | Con pagos | Tienda y suscripciones sin pago |

> Tras cambiar variables, reinicia `pnpm dev`. En Vercel, **redespliega** (las variables solo aplican a despliegues nuevos).

---

## 8. Ejecutar en local

```powershell
pnpm dev
```

- App: http://localhost:3000
- Primero registra tu usuario en `/signup` y confirma el correo (revisa tu bandeja o la consola si no configuraste Resend).
- Sigue la [sección 11](#11-primer-superadmin-planes-y-primera-barbería) para crear planes y la primera barbería.

Build de producción local: `pnpm build` y `pnpm start`. Lint: `pnpm lint`.

---

## 9. Vercel (producción)

1. https://vercel.com → **Add New → Project** → importa el repositorio de GitHub.
2. Framework: **Next.js** (autodetectado). Gestor: pnpm (detectado por `pnpm-lock.yaml`). Node 20.x o superior en **Settings → General**.
3. **Settings → Environment Variables**: carga **todas** las de la [sección 7](#7-variables-de-entorno), con valores de producción (`NEXT_PUBLIC_SITE_URL=https://www.sunwalk.app`, credenciales productivas de Mercado Pago, **sin** `MERCADOPAGO_TEST_PAYER_EMAIL`). Marca Production (y Preview si lo usas).
4. **Deploy**. La URL inicial es `https://projecto-barberia.vercel.app` o similar.
5. **Settings → Domains**: añade `www.sunwalk.app` (y `sunwalk.app` con redirección a `www`). Crea en tu DNS los registros que Vercel indica (CNAME `www` → `cname.vercel-dns.com`, y A/ALIAS para el dominio raíz). Espera el certificado SSL.
6. Con el dominio activo, **actualiza las URLs en los demás servicios**:
   - Supabase → Authentication → URL Configuration (Site URL y Redirect URLs).
   - Google Cloud → URIs de redirección de producción (`.../api/google-calendar/callback`).
   - Mercado Pago → URL del webhook.
   - Vault → `site_url` ([sección 10](#10-activar-la-sincronización-de-google-calendar-pg_cron)).
7. **Redespliega** para que las variables nuevas apliquen.

La sincronización de Calendar es una ruta Next.js (`maxDuration` ya definido en el código) que llama el cron de Supabase; **no hace falta un `vercel.json` con crons**.

**Verificación:** `https://www.sunwalk.app/` carga la landing; `/login` funciona con correo y con Google; una compra de prueba llega al webhook (Mercado Pago → Webhooks → historial de notificaciones).

---

## 10. Activar la sincronización de Google Calendar (pg_cron)

`BDD.SQL` crea el job `gcal-sincronizar` **desactivado**. Cada minuto llama a `POST <site_url>/api/google-calendar/sincronizar` con `Authorization: Bearer <cron_secret>` y vacía la cola de reservas pendientes de sincronizar.

En el **SQL Editor** de Supabase, con el sitio ya desplegado y `CRON_SECRET` cargado en Vercel:

1. Guarda el secreto y la URL en Vault (el secreto **idéntico** a `CRON_SECRET`):

```sql
SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
SELECT vault.create_secret('https://www.sunwalk.app', 'site_url');
-- Si ya existen, actualízalos:
-- SELECT vault.update_secret(id, '<valor>') FROM vault.secrets WHERE name = 'cron_secret';
```

2. Activa el job:

```sql
SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname = 'gcal-sincronizar';
```

3. Comprueba (a los 1–2 minutos):

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;
```

`status_code = 200` es correcto; `401` significa que `cron_secret` de Vault no coincide con `CRON_SECRET` de Vercel.

> Solo necesitas esto si usas el módulo `calendario`. El refresh token de Google de cada barbero se guarda cifrado en Vault (lo gestiona la app).

---

## 11. Primer superadmin, planes y primera barbería

La base nace vacía: no hay planes ni superadmin.

1. **Crea tu usuario** en `/signup` (o con Google) y confirma el correo.
2. **Hazte superadmin** (SQL Editor; la app no permite autoconcederlo):

```sql
UPDATE public.usuario SET rol = 'superadmin' WHERE email = 'tu-correo@ejemplo.com';
```

3. Entra a **`/admin`** → **Planes** y crea los planes (nombre, precio mensual, módulos y límites). Módulos disponibles: `agenda`, `ecommerce`, `bi`, `calendario`. Los planes inactivos se ocultan de la landing y de Suscripción. El precio mínimo de un plan de pago es $950 CLP.
4. Registra una barbería en **`/registro`** (con tu usuario o con otro): crea la barbería con 14 días de prueba, te deja como `admin` y crea la primera sucursal. El `slug` define la URL `/<slug>`.
5. En **Dashboard → Mi Barbería** completa logo, datos, sucursales y asigna barberos a sucursales; en **Equipo** invita a los barberos por correo; en **Horarios** define el horario semanal; en **Servicios** y **Productos** carga el catálogo.
6. Desde `/admin/barberias/[id]` puedes extender vigencia, cambiar plan, dar cortesía o suspender una barbería.

Para entregar un sitio público a clientes, completa los `[COMPLETAR]` de `/terminos` y `/privacidad` (`app/(legal)/`) con los datos reales y sube `VERSION_POLITICA` en `lib/plataforma.ts` cuando cambien esos textos.

---

## 12. Pruebas automáticas

Las pruebas (Vitest) usan un proyecto Supabase **distinto al de producción**:

1. Crea otro proyecto (o rama) de Supabase y aplícale `BDD.SQL`, `RLS.sql` y `BI.sql`, más un plan activo con el módulo `bi` y otro sin él.
2. Crea `.env.test.local`:

```env
TEST_SUPABASE_URL=https://<proyecto-de-pruebas>.supabase.co
TEST_SUPABASE_PUBLISHABLE_KEY=<anon key>
TEST_SUPABASE_SECRET_KEY=<service_role key>
```

3. Ejecuta `pnpm test`. El ayudante rechaza la URL de producción.

---

## 13. Lista de verificación final

- [ ] `BDD.SQL`, `RLS.sql` y `BI.sql` aplicados y bucket público `imgs` creado.
- [ ] Redirect URLs y Site URL en Supabase Auth con el dominio de producción.
- [ ] Dominio verificado en Resend; SMTP de Resend en Supabase; 4 plantillas pegadas.
- [ ] Cliente OAuth de Google con las tres URIs; proveedor Google activo en Supabase; Calendar API habilitada.
- [ ] Credenciales de Mercado Pago **de producción** y webhook apuntando a `/api/webhooks/mercadopago`.
- [ ] Todas las variables en Vercel y redespliegue hecho; `MERCADOPAGO_TEST_PAYER_EMAIL` **no** está en producción.
- [ ] Vault con `cron_secret` y `site_url`; job `gcal-sincronizar` activo y con `status_code = 200`.
- [ ] Superadmin creado, planes cargados y una barbería con servicios, horarios y barberos.
- [ ] Prueba de extremo a extremo: registrarse → reservar → recibir el correo → confirmar → completar la cita → recibir el correo de reseña; y una compra con tarjeta.

---

## 14. Problemas frecuentes

| Síntoma | Causa probable y solución |
|---|---|
| Error `permission denied` / datos que no aparecen | RLS o grants: no desactives RLS; revisa la política en `RLS.sql` y propón el arreglo en vez de saltarla |
| No llegan correos de la app | Falta `RESEND_API_KEY`, dominio sin verificar o `EMAIL_FROM` con otro dominio. Sin API key los links salen en la consola del servidor |
| No llegan correos de registro/recuperación | SMTP de Supabase sin configurar (límite del SMTP integrado) o contraseña SMTP distinta a la API key |
| El link de confirmación abre `/login?confirmado=1` | Normal si se abrió en otro navegador; inicia sesión con tu clave |
| `redirect_uri_mismatch` en Google | La URI exacta no está en el cliente OAuth (revisa `http`/`https`, `www` y la ruta) |
| "Conectar Google Calendar" no aparece | Faltan `GOOGLE_CLIENT_ID/SECRET`, tu usuario no tiene ficha de profesional o el plan no tiene el módulo `calendario` |
| Google muestra "app no verificada" | Esperado hasta verificar la app o usar usuarios de prueba (Testing) |
| Calendar no sincroniza | Job inactivo o `cron_secret` distinto de `CRON_SECRET` (401); revisa `net._http_response` |
| `max_attempts_exceeded` en pagos de prueba | Tarjeta de prueba bloqueada temporalmente: usa otra o espera |
| Mercado Pago 422 con credenciales de prueba | El comprador no es usuario de prueba: define `MERCADOPAGO_TEST_PAYER_EMAIL` |
| El webhook no actualiza en local | `localhost` no recibe webhooks; en local la app sincroniza al abrir Dashboard → Suscripción |
| Imágenes no cargan | Bucket `imgs` no es público o el host no está permitido en `next.config.ts` |
| Cambié una variable y no surte efecto | Reinicia `pnpm dev` o redespliega en Vercel |
| Las pruebas se niegan a ejecutarse | `TEST_SUPABASE_URL` apunta a producción: usa un proyecto de pruebas |
