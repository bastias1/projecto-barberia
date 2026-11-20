import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../utils/supabase/service-role";
import { one } from "./utils";

/**
 * HU-24: sincroniza la cola `reserva_evento_google` (la llena un trigger de `reserva`) con el
 * Google Calendar `primary` de cada barbero. Solo servidor: usa el service role y los tokens de Vault.
 */
export type AccionEvento = "crear" | "actualizar" | "borrar" | "nada";

/** Reservas activas tienen evento; canceladas/no_asistio lo pierden; completadas se dejan como están. */
export function accionEvento(reserva: { estado: string }, eventId: string | null): AccionEvento {
  if (reserva.estado === "pendiente" || reserva.estado === "confirmada") return eventId ? "actualizar" : "crear";
  if (reserva.estado === "cancelada" || reserva.estado === "no_asistio") return eventId ? "borrar" : "nada";
  return "nada";
}

const MAX_INTENTOS = 20;
const EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function env(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`${nombre} no está configurado`);
  return valor;
}

async function errorDe(res: Response): Promise<Error> {
  const data = await res.json().catch(() => null);
  const detalle = typeof data?.error === "string" ? data.error : data?.error?.message;
  return new Error(`Google ${res.status}${detalle ? `: ${detalle}` : ""}`);
}

/** Refresh token → access token. Un token revocado responde `invalid_grant`. */
async function accessToken(f: typeof fetch, refreshToken: string): Promise<string> {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(data?.error ?? `Google ${res.status}`);
  return data.access_token;
}

type Nombre = { nombre: string | null; apellido: string | null };
type FilaCola = {
  id_reserva: number; id_usuario: string; event_id: string | null; intentos: number; updated_at: string;
  barberia: unknown; reserva: unknown;
};
type Reserva = {
  estado: string; fecha_hora_inicio: string; fecha_hora_fin: string;
  servicio: unknown; sucursal: unknown; guest: unknown; cliente: unknown;
};

function evento(fila: FilaCola, r: Reserva) {
  const persona = one<Nombre>(r.cliente) ?? one<Nombre>(r.guest);
  const cliente = [persona?.nombre, persona?.apellido ? `${persona.apellido[0]}.` : null].filter(Boolean).join(" ");
  const sucursal = one<{ direccion: string; zona_horaria: string }>(r.sucursal);
  const timeZone = sucursal?.zona_horaria ?? "America/Santiago";
  return {
    summary: [one<{ nombre: string }>(r.servicio)?.nombre, cliente].filter(Boolean).join(" · "),
    location: sucursal?.direccion,
    description: `Reserva en ${one<{ nombre: string }>(fila.barberia)?.nombre ?? "la barbería"}`,
    start: { dateTime: r.fecha_hora_inicio, timeZone },
    end: { dateTime: r.fecha_hora_fin, timeZone },
  };
}

/** Aplica en Google lo que pide la reserva; devuelve el event_id resultante (null si ya no hay evento). */
async function aplicar(f: typeof fetch, token: string, fila: FilaCola, r: Reserva): Promise<string | null> {
  const accion = accionEvento(r, fila.event_id);
  if (accion === "nada") return fila.event_id;
  const llamar = (url: string, method: string, body?: unknown) => f(url, {
    method, signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const url = `${EVENTOS}/${encodeURIComponent(fila.event_id ?? "")}`;
  // 404/410: el barbero borró el evento en Google
  const perdido = (res: Response) => res.status === 404 || res.status === 410;

  if (accion === "borrar") {
    const res = await llamar(url, "DELETE");
    if (!res.ok && !perdido(res)) throw await errorDe(res);
    return null;
  }
  if (accion === "actualizar") {
    const res = await llamar(url, "PATCH", evento(fila, r));
    if (res.ok) return fila.event_id;
    if (!perdido(res)) throw await errorDe(res);
  }
  const res = await llamar(EVENTOS, "POST", evento(fila, r));
  if (!res.ok) throw await errorDe(res);
  return (await res.json()).id;
}

/**
 * Vacía hasta `limite` filas pendientes de la cola (lo llama el job pg_cron cada minuto).
 * Éxito → pendiente=false; error → intentos+1 y ultimo_error (se deja de intentar a los 20);
 * un refresh token revocado (`invalid_grant`) además queda en `calendario_google.ultimo_error`.
 */
export async function sincronizarPendientes(
  limite = 50, db: SupabaseClient = createServiceRoleClient(), f: typeof fetch = fetch,
): Promise<{ sincronizadas: number; errores: number }> {
  const { data, error } = await db.from("reserva_evento_google")
    .select(`id_reserva, id_usuario, event_id, intentos, updated_at, barberia (nombre),
      reserva (estado, fecha_hora_inicio, fecha_hora_fin,
        servicio:servicio!reserva_servicio_fkey (nombre),
        sucursal:sucursal!reserva_sucursal_fkey (direccion, zona_horaria),
        guest:guest_usuario!reserva_guest_fkey (nombre, apellido),
        cliente:usuario!reserva_cliente_fkey (nombre, apellido))`)
    .eq("pendiente", true).lt("intentos", MAX_INTENTOS).order("updated_at").limit(limite);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaCola[];

  // Solo se marca la fila si nadie la re-encoló mientras tanto (el trigger cambia updated_at)
  const marcar = (fila: FilaCola, cambios: Record<string, unknown>) => db.from("reserva_evento_google")
    .update(cambios).eq("id_reserva", fila.id_reserva).eq("updated_at", fila.updated_at);
  const fallar = (fila: FilaCola, e: unknown) => marcar(fila, {
    intentos: fila.intentos + 1, ultimo_error: String(e instanceof Error ? e.message : e).slice(0, 500),
    updated_at: new Date().toISOString(), // al final de la cola: no tapa a las demás
  });

  let sincronizadas = 0;
  let errores = 0;
  for (const idUsuario of new Set(filas.map((x) => x.id_usuario))) {
    const suyas = filas.filter((x) => x.id_usuario === idUsuario);
    let token: string;
    try {
      const { data: refresh, error: errToken } = await db.rpc("gcal_token", { p_usuario: idUsuario });
      if (errToken || !refresh) throw new Error(errToken?.message ?? "Sin refresh token");
      token = await accessToken(f, refresh as string);
      await db.from("calendario_google").update({ ultimo_error: null, ultimo_error_at: null })
        .eq("id_usuario", idUsuario).not("ultimo_error", "is", null);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (mensaje === "invalid_grant") {
        await db.from("calendario_google").update({
          ultimo_error: "Google revocó el acceso: vuelve a conectar tu calendario", ultimo_error_at: new Date().toISOString(),
        }).eq("id_usuario", idUsuario);
      }
      for (const fila of suyas) await fallar(fila, e);
      errores += suyas.length;
      continue;
    }

    for (const fila of suyas) {
      const r = one<Reserva>(fila.reserva);
      try {
        if (!r) throw new Error("Reserva no encontrada");
        const eventId = await aplicar(f, token, fila, r);
        // el event_id se guarda siempre: si la fila fue re-encolada, el próximo ciclo lo necesita
        if (eventId !== fila.event_id) {
          await db.from("reserva_evento_google").update({ event_id: eventId }).eq("id_reserva", fila.id_reserva);
        }
        await marcar(fila, { pendiente: false, ultimo_error: null });
        sincronizadas++;
      } catch (e) {
        await fallar(fila, e);
        errores++;
      }
    }
  }
  return { sincronizadas, errores };
}
