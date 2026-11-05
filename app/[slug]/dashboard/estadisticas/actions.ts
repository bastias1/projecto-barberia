"use server";

import { getStaffContext } from "@/lib/staff-context";
import { cargarDatos, type DatosBI, type FiltrosBI, type Granularidad, type ModoBI, type Rango } from "@/lib/services/bi-service";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRANULARIDADES: Granularidad[] = ["day", "week", "month"];

const entero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined);

/**
 * Recalcula un gráfico con sus propios filtros. Todo lo que llega del cliente se valida aquí;
 * "negocio" exige admin, "propio" exige agenda propia y fuerza al profesional (sin productos).
 * La BD además verifica staff + módulo bi y limita a un no admin a sus propias citas.
 */
export async function cargarGrafico<K extends keyof DatosBI>(
  slug: string, grafico: K, rango: Rango, filtros: FiltrosBI, modo: ModoBI,
): Promise<{ ok: true; datos: DatosBI[K] } | { ok: false }> {
  const ctx = await getStaffContext(slug);
  if (!ctx) return { ok: false };
  const propio = modo === "propio";
  if (propio ? !(ctx.isStaff && ctx.isProfesional) || grafico === "productos" : !ctx.isAdmin) return { ok: false };
  if (!FECHA.test(rango.desde) || !FECHA.test(rango.hasta) || !GRANULARIDADES.includes(rango.gran)) return { ok: false };

  const limpios: FiltrosBI = {
    sucursal: entero(filtros.sucursal),
    servicio: entero(filtros.servicio),
    profesional: propio ? ctx.userId
      : typeof filtros.profesional === "string" && UUID.test(filtros.profesional) ? filtros.profesional : undefined,
    tipo: !propio && (filtros.tipo === "servicios" || filtros.tipo === "productos") ? filtros.tipo : undefined,
  };

  try {
    return { ok: true, datos: await cargarDatos(ctx.barberia.id_barberia, grafico, rango, limpios) };
  } catch (error) {
    console.error(`[estadisticas] no se pudo recalcular "${String(grafico)}":`, error);
    return { ok: false };
  }
}
