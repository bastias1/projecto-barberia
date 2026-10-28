import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Navaja <notificaciones@sunwalk.app>";

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

export function emailButton(href: string, label: string, color = "#18181b"): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:4px 6px 4px 0">${escapeHtml(label)}</a>`;
}

export function emailLayout(
  titulo: string,
  cuerpo: string,
  barberia: string,
  pie = `Recibes este correo por tu reserva o compra en ${barberia}.`,
): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">${escapeHtml(barberia)}</p>
        <h1 style="margin:0 0 20px;font-size:22px">${escapeHtml(titulo)}</h1>
        ${cuerpo}
        <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa">${escapeHtml(pie)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function emailDetalle(filas: Array<[string, string]>): string {
  const rows = filas
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#71717a">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" style="background:#f4f4f5;border-radius:8px;padding:12px 16px;margin:0 0 20px">${rows}</table>`;
}
