"use server";

import { getStaffContext } from "@/lib/staff-context";
import { cargarDatos, type DatosBI, type FiltrosBI, type Granularidad, type Rango } from "@/lib/services/bi-service";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRANULARIDADES: Granularidad[] = ["day", "week", "month"];

const entero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined);

/** Recalcula un gráfico con sus propios filtros. Todo lo que llega del cliente se valida aquí; el acceso (admin + módulo bi) lo exige además la BD. */
export async function cargarGrafico<K extends keyof DatosBI>(
  slug: string, grafico: K, rango: Rango, filtros: FiltrosBI,
): Promise<{ ok: true; datos: DatosBI[K] } | { ok: false }> {
  const ctx = await getStaffContext(slug);
  if (!ctx?.isAdmin) return { ok: false };
  if (!FECHA.test(rango.desde) || !FECHA.test(rango.hasta) || !GRANULARIDADES.includes(rango.gran)) return { ok: false };

  const limpios: FiltrosBI = {
    sucursal: entero(filtros.sucursal),
    servicio: entero(filtros.servicio),
    profesional: typeof filtros.profesional === "string" && UUID.test(filtros.profesional) ? filtros.profesional : undefined,
    tipo: filtros.tipo === "servicios" || filtros.tipo === "productos" ? filtros.tipo : undefined,
  };

  try {
    return { ok: true, datos: await cargarDatos(ctx.barberia.id_barberia, grafico, rango, limpios) };
  } catch (error) {
    console.error(`[estadisticas] no se pudo recalcular "${String(grafico)}":`, error);
    return { ok: false };
  }
}
