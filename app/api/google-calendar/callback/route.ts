import { NextRequest } from "next/server";
import { getStaffContext } from "@/lib/staff-context";
import { canjearCodigo, leerState } from "@/lib/google-calendar-oauth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { todasLasFilas } from "@/lib/utils";
import { volverAConfiguracion } from "../volver";

/**
 * HU-24: vuelta de Google. Guarda el refresh token en Vault, crea el vínculo `calendario_google`
 * y encola las reservas futuras activas del barbero (las nuevas las encola el trigger de `reserva`).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = leerState(params.get("state"));
  if (!state) return volverAConfiguracion(request, null, "error");
  const { userId, slug } = state;

  const code = params.get("code"); // sin code = el usuario canceló en Google (?error=access_denied)
  // La sesión debe ser la misma que pidió el vínculo: el state solo no basta si alguien comparte el link
  const ctx = await getStaffContext(slug);
  if (!code || !ctx || ctx.userId !== userId || !ctx.isProfesional) return volverAConfiguracion(request, slug, "error");

  try {
    const { refreshToken, email } = await canjearCodigo(code);
    const admin = createServiceRoleClient();
    const { data: idSecreto, error: errToken } = await admin.rpc("gcal_guardar_token", { p_usuario: userId, p_token: refreshToken });
    if (errToken) throw errToken;
    const ahora = new Date().toISOString();
    const { error: errVinculo } = await admin.from("calendario_google").upsert({
      id_usuario: userId, email_google: email, id_secreto: idSecreto as string,
      conectado_at: ahora, ultimo_error: null, ultimo_error_at: null,
    });
    if (errVinculo) throw errVinculo;

    // Backfill: reservas futuras activas (como el trigger, sin mirar el módulo: el worker salta las barberías sin él)
    const { data: reservas, error: errReservas } = await todasLasFilas(() => admin.from("reserva")
      .select("id_reserva, id_barberia")
      .eq("id_profesional", userId)
      .in("estado", ["pendiente", "confirmada"])
      .gte("fecha_hora_inicio", ahora)
      .order("id_reserva"));
    if (errReservas) throw errReservas;
    const filas = reservas.map((r) => ({
      id_reserva: r.id_reserva as number, id_barberia: r.id_barberia as string, id_usuario: userId,
      pendiente: true, intentos: 0, ultimo_error: null, updated_at: ahora,
    }));
    if (filas.length) {
      const { error } = await admin.from("reserva_evento_google").upsert(filas); // conserva event_id si ya existía
      if (error) throw error;
    }
    return volverAConfiguracion(request, slug, "ok");
  } catch (error) {
    console.error("Google Calendar - error al vincular:", error);
    return volverAConfiguracion(request, slug, "error");
  }
}
