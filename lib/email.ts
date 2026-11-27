import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Sunwalk <notificaciones@sunwalk.app>";

// El dominio de prueba de Resend solo entrega al dueño de la cuenta
if (/@resend\.dev>?$/.test(FROM)) {
  console.warn(`[email] EMAIL_FROM usa ${FROM}: Resend solo entregará al correo dueño de la cuenta. Usa una dirección de sunwalk.app.`);
}

/** Remitente con el nombre de la barbería y la dirección configurada en EMAIL_FROM. */
function remitente(nombre?: string): string {
  if (!nombre) return FROM;
  const direccion = FROM.match(/<([^>]+)>/)?.[1] ?? FROM;
  return `${nombre.replace(/[<>"]/g, "")} <${direccion}>`;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  fromName?: string; // nombre de la barbería que envía
  replyTo?: string | null; // las respuestas del cliente le llegan a la barbería
}

/** Versión en texto plano del HTML (mejora la entrega y la lectura en clientes simples). */
export function htmlATexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, texto) => `\n${texto.replace(/<[^>]+>/g, "").trim()}: ${href}\n`)
    .replace(/<\/(p|h1|h2|tr|li|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    // sin líneas vacías repetidas
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join("\n")
    .trim();
}

/**
 * Envía un correo con Resend. Nunca lanza: un correo fallido no debe romper
 * la reserva o el cambio de estado que lo originó.
 */
export async function sendEmail({ to, subject, html, fromName, replyTo }: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no configurado; no se envió "${subject}" a ${to}`);
    return false;
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: remitente(fromName),
      to,
      subject,
      html,
      text: htmlATexto(html),
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] Error enviando "${subject}" a ${to}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[email] Excepción enviando "${subject}" a ${to}:`, error);
    return false;
  }
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bulletproof button para email: tabla anidada + VML para Outlook.
 * Usa el color de marca oscura (#18181b) para accesibilidad (AA sobre blanco).
 * El menta (#a1ffcb) solo se usa como acento decorativo (bordes, badges).
 */
export function emailButton(href: string, label: string, color = "#18181b"): string {
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  const bg = escapeHtml(color);
  const fg = color === "#dc2626" ? "#ffffff" : "#ffffff"; // texto blanco en botones oscuros/rojos

  // VML para Outlook (mso) — botón relleno que no se rompe
  const vml = `<!--[if mso]>
  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:200px;" stroke="f" fillcolor="${bg}">
    <v:textbox inset="0,0,0,0"><center style="color:${fg};font-family:Arial,sans-serif;font-size:16px;font-weight:600;">${safeLabel}</center></v:textbox>
  </v:rect>
<![endif]-->`;

  // HTML estándar para el resto de clientes
  return `${vml}
<!--[if !mso]><!-->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 6px 4px 0;">
  <tr>
    <td style="border-radius:8px;background:${bg};" bgcolor="${bg}">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;font-family:'Geist',Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:${fg};text-decoration:none;line-height:1.2;border-radius:8px;" role="button">${safeLabel}</a>
    </td>
  </tr>
</table>
<!--<![endif]-->`;
}

/**
 * Layout base del email con tokens de diseño de la web:
 * - Fondo #f4f4f5 (neutral-100), tarjeta blanca con borde #e6e6e6 (border)
 * - Radio 12px (tarjeta), 8px (botones)
 * - Tipografía Geist Sans (fallback Arial)
 * - Acento menta #a1ffcb solo en barra superior decorativa y badges
 * - Preheader invisible para preview en bandeja de entrada
 */
export function emailLayout(
  titulo: string,
  cuerpo: string,
  barberia: string,
  opciones?: {
    pie?: string;
    preheader?: string;
    logoUrl?: string | null;
    instagram?: string | null;
  },
): string {
  const pie = opciones?.pie ?? `Recibes este correo por tu reserva o compra en ${barberia}.`;
  const safeTitulo = escapeHtml(titulo);
  const safeBarberia = escapeHtml(barberia);
  const safePie = escapeHtml(pie);
  const preheader = opciones?.preheader ? escapeHtml(opciones.preheader) : "";
  const logoUrl = opciones?.logoUrl ? escapeHtml(opciones.logoUrl) : "";
  const instagram = opciones?.instagram ? escapeHtml(opciones.instagram) : "";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="" style="display:block;height:40px;width:auto;margin:0 auto 16px;border:0;outline:none;text-decoration:none;">`
    : `<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">${safeBarberia}</p>`;

  const instagramHtml = instagram
    ? `<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa">Síguenos: <a href="https://instagram.com/${instagram}" style="color:#2f6b4d;text-decoration:none" target="_blank" rel="noopener">@${instagram}</a></p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no,address=no,email=no,url=no">
    ${preheader ? `<meta name="preheader" content="${preheader}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;font-size:1px;line-height:1px">${preheader}</div>` : ""}
    <title>${safeTitulo}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:'Geist',Arial,Helvetica,sans-serif;color:#232323;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;">
            <tr>
              <!-- Barra superior decorativa con acento menta -->
              <td style="background:#a1ffcb;height:4px;"></td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${logoHtml}
                <h1 style="margin:0 0 20px;font-family:'Geist',Arial,Helvetica,sans-serif;font-size:22px;font-weight:500;line-height:1.2;letter-spacing:-0.035em;color:#232323">${safeTitulo}</h1>
                ${cuerpo}
                <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa">${safePie}</p>
                ${instagramHtml}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#a1a1aa;font-family:Arial,Helvetica,sans-serif">
            Sunwalk · Agenda online, tienda y gestión para barberías<br>
            <a href="https://sunwalk.app" style="color:#2f6b4d;text-decoration:none">sunwalk.app</a> · <a href="mailto:contact@sunwalk.app" style="color:#2f6b4d;text-decoration:none">contact@sunwalk.app</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Tabla de detalle (key/value) con estilo de tarjeta suave. */
export function emailDetalle(filas: Array<[string, string]>): string {
  const rows = filas
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#71717a;font-size:14px">${escapeHtml(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600;font-size:14px;color:#232323">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:16px;margin:0 0 20px">${rows}</table>`;
}

/** Badge decorativo con acento menta (para etiquetas de estado, etc.) */
export function emailBadge(texto: string): string {
  return `<span style="display:inline-block;padding:4px 10px;background:#a1ffcb;color:#0f2a1c;font-size:12px;font-weight:600;border-radius:9999px;font-family:'Geist',Arial,Helvetica,sans-serif;line-height:1">${escapeHtml(texto)}</span>`;
}

/** Divisor horizontal sutil */
export function emailDivider(): string {
  return `<hr style="border:0;border-top:1px solid #e6e6e6;margin:20px 0">`;
}