import type { SupabaseClient } from "@supabase/supabase-js";

/** Datos públicos que se muestran en la página de inicio de una barbería. */

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden de la semana chilena: lunes primero
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export interface TramoHorario {
  dias: string;  // "Lun - Sáb" o "Dom"
  horas: string; // "09:00 - 20:00"
}

/**
 * Horario general de la barbería (o de una sucursal): por cada día, desde la
 * primera hora de apertura hasta la última de cierre entre todos sus
 * barberos. Agrupa los días consecutivos con el mismo horario.
 */
export async function getHorarioResumen(supabase: SupabaseClient, idBarberia: string, idSucursal?: number): Promise<TramoHorario[]> {
  let query = supabase
    .from("horario_atencion")
    .select("dia_semana, hora_inicio, hora_fin")
    .eq("id_barberia", idBarberia)
    .eq("activo", true);
  if (idSucursal) query = query.eq("id_sucursal", idSucursal);
  const { data } = await query;

  const porDia = new Map<number, { inicio: string; fin: string }>();
  for (const h of data ?? []) {
    const inicio = String(h.hora_inicio).slice(0, 5);
    const fin = String(h.hora_fin).slice(0, 5);
    const actual = porDia.get(h.dia_semana);
    porDia.set(h.dia_semana, {
      inicio: !actual || inicio < actual.inicio ? inicio : actual.inicio,
      fin: !actual || fin > actual.fin ? fin : actual.fin,
    });
  }

  const tramos: Array<{ desde: number; hasta: number; horas: string }> = [];
  for (const dia of ORDEN_SEMANA) {
    const h = porDia.get(dia);
    if (!h) continue;
    const horas = `${h.inicio} - ${h.fin}`;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.horas === horas && ORDEN_SEMANA.indexOf(ultimo.hasta) === ORDEN_SEMANA.indexOf(dia) - 1) {
      ultimo.hasta = dia;
    } else {
      tramos.push({ desde: dia, hasta: dia, horas });
    }
  }

  return tramos.map((t) => ({
    dias: t.desde === t.hasta ? DIAS_CORTOS[t.desde] : `${DIAS_CORTOS[t.desde]} - ${DIAS_CORTOS[t.hasta]}`,
    horas: t.horas,
  }));
}

/** La tienda se muestra solo si la barbería tiene productos a la venta. */
export async function tieneTienda(supabase: SupabaseClient, idBarberia: string): Promise<boolean> {
  const { count } = await supabase
    .from("producto")
    .select("id_producto", { count: "exact", head: true })
    .eq("id_barberia", idBarberia)
    .eq("activo", true);
  return (count ?? 0) > 0;
}

/** Mapa embebido de Google Maps a partir de la dirección (no requiere API key). */
export function mapaEmbedUrl(direccion: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;
}

/** "benjvmin._" o "@benjvmin._" o una URL -> URL del perfil de Instagram. */
export function instagramUrl(instagram: string): string {
  if (/^https?:\/\//.test(instagram)) return instagram;
  return `https://www.instagram.com/${instagram.replace(/^@/, "")}/`;
}
