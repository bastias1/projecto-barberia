# Verificación de la app de Google (OAuth)

Sunwalk pide a Google dos cosas:

| Flujo | Scopes | ¿Requiere verificación? |
|---|---|---|
| Iniciar sesión con Google (Supabase Auth) | `openid`, `email`, `profile` | No (no sensibles); solo **verificación de marca** para mostrar nombre y logo |
| Google Calendar (HU-24, `/api/google-calendar/*`) | `https://www.googleapis.com/auth/calendar.events` | **Sí: scope sensible** (sin verificar: aviso de "app no verificada" y tope de 100 usuarios) |

`calendar.events` es sensible, no restringido: **no** pide auditoría de seguridad (CASA), solo revisión del uso.

## 1. Antes de enviar (en el sitio)

- [ ] Página de inicio pública en el dominio verificado: `https://www.sunwalk.app` (explica qué hace Sunwalk, sin login, con enlace a privacidad y términos en el pie: `LegalLinks`).
- [ ] Política de privacidad pública: `https://www.sunwalk.app/privacidad`. Ya incluye la sección "Si usas tu cuenta de Google" (qué datos, para qué, cómo revocar) y la declaración de **Uso Limitado**.
- [ ] Completar los `[COMPLETAR]` de `/privacidad` y `/terminos` (razón social, RUT, domicilio, fecha de vigencia). Google rechaza políticas incompletas o con texto de relleno.
- [ ] Términos: `https://www.sunwalk.app/terminos`.

## 2. Dominio

- [ ] Verificar la propiedad de `sunwalk.app` en [Google Search Console](https://search.google.com/search-console) (registro TXT en el DNS), con una cuenta que sea **propietaria o editora** del proyecto de Google Cloud.

## 3. Google Cloud → Google Auth Platform

**Branding**
- Nombre de la app: `Sunwalk` (igual al que se ve en el sitio).
- Correo de soporte: una cuenta Google tuya o un grupo.
- Logo: cuadrado, 120×120 px, PNG/JPG, el mismo del sitio (subirlo inicia una revisión de marca).
- Página principal: `https://www.sunwalk.app`
- Política de privacidad: `https://www.sunwalk.app/privacidad`
- Términos: `https://www.sunwalk.app/terminos`
- Dominios autorizados: `sunwalk.app` (y `supabase.co`, ver nota).

**Clientes (Credentials → OAuth client)**
- URIs de redirección de producción: `https://www.sunwalk.app/api/google-calendar/callback` y `https://jrffkkktryskigbglpit.supabase.co/auth/v1/callback`.
- Quitar del cliente de producción `localhost` y `*.vercel.app`: crea un **segundo cliente** "Sunwalk dev" para desarrollo (con `http://localhost:3000/api/google-calendar/callback`) y úsalo en `.env.local`. Las URIs fuera de dominios verificados son motivo frecuente de rechazo.

**Data access (scopes)**: agregar solo `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` y `.../auth/calendar.events`. Nada más.

**Audience**: pasar de *Testing* a *In production* y luego **Prepare for verification**.

## 4. Texto para la justificación del scope (copiar en inglés)

> Sunwalk is a booking platform for barbershops. Each barber can optionally connect their own Google Calendar from Dashboard → Configuración. We use `calendar.events` only to create, update and delete, in the barber's primary calendar, one event per booking they receive on Sunwalk (client name, service, branch address, start and end time), so their appointments appear in the calendar they use daily. Events follow the booking: rescheduling moves the event, cancelling deletes it. We never read, list or modify any other event. A narrower scope is not enough: `calendar.events.owned` / `calendar.app.created` would require a separate secondary calendar, while barbers asked to see bookings in their main calendar. The refresh token is stored encrypted (Supabase Vault) and deleted when the barber disconnects. Google user data is not shared, sold, used for ads or used to train AI models.

## 5. Video de demostración (YouTube, oculto)

Graba en inglés o con subtítulos en inglés, 2–4 minutos, en `https://www.sunwalk.app`:
1. Mostrar la página principal y el enlace a la política de privacidad.
2. Iniciar sesión como barbero → Dashboard → Configuración → tarjeta **Google Calendar** → **Conectar Google Calendar**.
3. En la pantalla de consentimiento de Google, que se vea la **barra de direcciones con el `client_id`** y el permiso de calendario; aceptar.
4. Volver a Configuración ("Conectado como …").
5. Crear una reserva para ese barbero y mostrar el evento en Google Calendar; cancelarla y mostrar que el evento desaparece.
6. **Desconectar** y mostrar que el acceso se revoca (myaccount.google.com/permissions).

## 6. Después de enviar

- Google responde por correo al correo de soporte/desarrollador; suele pedir ajustes. Respondan en el mismo hilo.
- Plazo típico: de algunos días a varias semanas.
- Mientras tanto, la app sigue funcionando en *Testing* con los usuarios de prueba agregados.

## Nota: inicio de sesión con Supabase

El login con Google vuelve a `jrffkkktryskigbglpit.supabase.co`, un dominio que no puedes verificar. Con solo scopes básicos normalmente basta para la verificación de marca, pero la pantalla de Google mostrará `supabase.co` como destino. Para que muestre tu dominio hace falta un **dominio personalizado de Supabase** (complemento pago, p. ej. `auth.sunwalk.app`). Confirmar con Google si lo piden durante la revisión.
