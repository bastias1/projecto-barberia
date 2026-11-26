# Plantillas de correo de Supabase Auth

Supabase Auth envía estos correos por el SMTP de Resend (Dashboard → Authentication → Emails → SMTP Settings). Pega cada plantilla en Dashboard → Authentication → Emails → Templates:

| Plantilla en Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirmacion.html` | Confirma tu correo |
| Reset password | `recuperar-clave.html` | Crea una nueva contraseña |
| Change email address | `cambio-correo.html` | Confirma tu nuevo correo |
| Magic link | `magic-link.html` | Tu link para entrar |

Variables de Supabase usadas: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .RedirectTo }}`, `{{ .TokenHash }}`.

`recuperar-clave.html` enlaza con el `token_hash` a la URL que pidió el cambio (`{{ .RedirectTo }}` = `<sitio>/cuenta/clave`; no usa `ConfirmationURL`): así funciona aunque el correo se abra en otro navegador y vuelve al mismo entorno.

Al instalarla, en este orden: 1) desplegar el código; 2) agregar `<sitio>/cuenta/clave` (producción y `http://localhost:3000`) en Authentication → URL Configuration → Redirect URLs; 3) pegar la plantilla. Sin el paso 2, Supabase usa la Site URL y el link cae en el inicio. Entre los pasos 1 y 3 la recuperación no funciona: hacerlos seguidos.

Los correos propios de la app (reservas, reseñas, invitaciones) se arman en `lib/notifications.ts` con el mismo diseño (`emailLayout` en `lib/email.ts`).
