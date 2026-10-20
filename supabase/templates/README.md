# Plantillas de correo de Supabase Auth

Supabase Auth envía estos correos por el SMTP de Resend (Dashboard → Authentication → Emails → SMTP Settings). Pega cada plantilla en Dashboard → Authentication → Emails → Templates:

| Plantilla en Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirmacion.html` | Confirma tu correo |
| Reset password | `recuperar-clave.html` | Crea una nueva contraseña |
| Change email address | `cambio-correo.html` | Confirma tu nuevo correo |
| Magic link | `magic-link.html` | Tu link para entrar |

Variables de Supabase usadas: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`.

Los correos propios de la app (reservas, reseñas, invitaciones) se arman en `lib/notifications.ts` con el mismo diseño (`emailLayout` en `lib/email.ts`).
