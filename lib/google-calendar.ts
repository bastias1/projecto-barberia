import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../utils/supabase/service-role";
import { renovarAccessToken } from "./google-calendar-oauth";
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

const EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function errorDe(res: Response): Promise<Error> {
  const data = await res.json().catch(() => null);
  const detalle = typeof data?.error === "string" ? data.error : data?.error?.message;
  return new Error(`Google ${res.status}${detalle ? `: ${detalle}` : ""}`);
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
 * Vacía hasta `limite` filas de la cola (lo llama el job pg_cron cada minuto). `gcal_reclamar` las
 * reserva por 2 minutos (dos ejecuciones nunca toman la misma), salta las barberías sin 'calendario'
 * y deja las de 20+ intentos para una vez por hora. Se detiene al pasar `presupuestoMs` y suelta lo
 * que no alcanzó. Éxito → pendiente=false; error → intentos+1 y ultimo_error. El último error de
 * cada barbero queda en `calendario_google.ultimo_error` hasta que una fila suya se sincronice.
 */
export async function sincronizarPendientes(
  limite = 20, db: SupabaseClient = createServiceRoleClient(), f: typeof fetch = fetch, presupuestoMs = 40_000,
): Promise<{ sincronizadas: number; errores: number }> {
  const fin = Date.now() + presupuestoMs;
  const { data: reclamadas, error: errReclamar } = await db.rpc("gcal_reclamar", { p_limite: limite });
  if (errReclamar) throw new Error(errReclamar.message);
  const ids = ((reclamadas ?? []) as { id_reserva: number }[]).map((x) => x.id_reserva);
  if (!ids.length) return { sincronizadas: 0, errores: 0 };

  const cola = () => db.from("reserva_evento_google");
  const { data, error } = await cola()
    .select(`id_reserva, id_usuario, event_id, intentos, updated_at, barberia (nombre),
      reserva (estado, fecha_hora_inicio, fecha_hora_fin,
        servicio:servicio!reserva_servicio_fkey (nombre),
        sucursal:sucursal!reserva_sucursal_fkey (direccion, zona_horaria),
        guest:guest_usuario!reserva_guest_fkey (nombre, apellido),
        cliente:usuario!reserva_cliente_fkey (nombre, apellido))`)
    .in("id_reserva", ids).order("updated_at");
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaCola[];
  const sinTocar = new Set(ids);

  // `cambios` solo si nadie la re-encoló mientras tanto (el trigger cambia updated_at); si no, `siReencolada`.
  // Ambos sueltan la reserva de la fila.
  const marcar = async (fila: FilaCola, cambios: Record<string, unknown>, siReencolada: Record<string, unknown> = {}) => {
    const { data: hecho, error: e1 } = await cola().update({ ...cambios, bloqueada_hasta: null })
      .eq("id_reserva", fila.id_reserva).eq("updated_at", fila.updated_at).select("id_reserva");
    if (e1) throw new Error(e1.message);
    if (hecho?.length) return;
    const { error: e2 } = await cola().update({ ...siReencolada, bloqueada_hasta: null }).eq("id_reserva", fila.id_reserva);
    if (e2) throw new Error(e2.message);
  };
  const mensaje = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 500);
  const fallar = (fila: FilaCola, e: unknown) => marcar(fila, {
    intentos: fila.intentos + 1, ultimo_error: mensaje(e),
    updated_at: new Date().toISOString(), // al final de la cola: no tapa a las demás
  }).catch((err) => console.error("[google-calendar] no se pudo registrar el error de la fila", fila.id_reserva, err));

  let sincronizadas = 0;
  let errores = 0;
  for (const idUsuario of new Set(filas.map((x) => x.id_usuario))) {
    if (Date.now() >= fin) break;
    const suyas = filas.filter((x) => x.id_usuario === idUsuario);
    let ultimoError: string | null = null;
    let alguna = false;
    let token: string | null = null;
    try {
      const { data: refresh, error: errToken } = await db.rpc("gcal_token", { p_usuario: idUsuario });
      if (errToken || !refresh) throw new Error(errToken?.message ?? "Sin refresh token");
      token = await renovarAccessToken(refresh as string, f);
    } catch (e) {
      ultimoError = mensaje(e) === "invalid_grant" ? "Google revocó el acceso: vuelve a conectar tu calendario" : mensaje(e);
      for (const fila of suyas) { sinTocar.delete(fila.id_reserva); await fallar(fila, e); }
      errores += suyas.length;
    }

    for (const fila of token ? suyas : []) {
      if (Date.now() >= fin) break;
      sinTocar.delete(fila.id_reserva);
      const r = one<Reserva>(fila.reserva);
      try {
        if (!r) throw new Error("Reserva no encontrada");
        const eventId = await aplicar(f, token!, fila, r);
        // si la fila fue re-encolada el event_id se guarda igual: el próximo ciclo lo necesita
        await marcar(fila, { pendiente: false, ultimo_error: null, event_id: eventId }, { event_id: eventId });
        sincronizadas++;
        alguna = true;
      } catch (e) {
        await fallar(fila, e);
        errores++;
        ultimoError = mensaje(e);
      }
    }

    const vinculo = db.from("calendario_google");
    if (ultimoError) await vinculo.update({ ultimo_error: ultimoError, ultimo_error_at: new Date().toISOString() }).eq("id_usuario", idUsuario);
    else if (alguna) await vinculo.update({ ultimo_error: null, ultimo_error_at: null }).eq("id_usuario", idUsuario).not("ultimo_error", "is", null);
  }
  // lo que no alcanzó a procesarse queda libre para el próximo ciclo
  if (sinTocar.size) await cola().update({ bloqueada_hasta: null }).in("id_reserva", [...sinTocar]);
  return { sincronizadas, errores };
}
