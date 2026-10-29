import { createClient } from "@/utils/supabase/server";

/**
 * Estadísticas (módulo BI). Los cálculos viven en funciones SQL `bi_*` (ver BI.sql):
 * solo responden al admin de una barbería con el módulo `bi`.
 */

export type Granularidad = "day" | "week" | "month";

export interface IngresoPeriodo {
  periodo: string; // YYYY-MM-DD, inicio del día/semana/mes
  servicios: number;
  productos: number;
  total: number;
  transacciones: number;
}

export interface RankingItem {
  id: number;
  nombre: string;
  cantidad: number;
  monto: number;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export interface DemandaCelda {
  dow: number; // 0 = domingo
  hora: number;
  citas: number;
}

export interface Ocupacion {
  id: string;
  nombre: string;
  publicados: number; // minutos
  reservados: number; // minutos
}

export interface ResumenMes {
  mes: string;
  ingresos: number;
  transacciones: number;
  ticket: number | null;
  completadas: number;
  noAsistio: number;
  tasaNoShow: number | null; // porcentaje
}

export function getDemanda(idBarberia: string, desde: string, hasta: string) {
  return rpc<DemandaCelda>("bi_demanda", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta });
}

export async function getOcupacion(idBarberia: string, desde: string, hasta: string): Promise<Ocupacion[]> {
  const rows = await rpc<{ id_profesional: string; nombre: string; minutos_publicados: number; minutos_reservados: number }>(
    "bi_ocupacion", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta });
  return rows.map((r) => ({
    id: r.id_profesional, nombre: r.nombre, publicados: r.minutos_publicados, reservados: r.minutos_reservados,
  }));
}

export async function getResumenMensual(idBarberia: string, desde: string, hasta: string): Promise<ResumenMes[]> {
  const rows = await rpc<{
    mes: string; ingresos: number; transacciones: number; ticket_promedio: number | null;
    completadas: number; no_asistio: number; tasa_no_show: number | null;
  }>("bi_resumen_mensual", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta });
  return rows.map((r) => ({
    mes: r.mes, ingresos: r.ingresos, transacciones: r.transacciones, ticket: r.ticket_promedio,
    completadas: r.completadas, noAsistio: r.no_asistio, tasaNoShow: r.tasa_no_show,
  }));
}

export function getIngresos(idBarberia: string, desde: string, hasta: string, gran: Granularidad) {
  return rpc<IngresoPeriodo>("bi_ingresos", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta, p_gran: gran });
}

export async function getRankingServicios(idBarberia: string, desde: string, hasta: string): Promise<RankingItem[]> {
  const rows = await rpc<{ id_servicio: number; nombre: string; cantidad: number; ingresos: number }>(
    "bi_servicios", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta });
  return rows.map((r) => ({ id: r.id_servicio, nombre: r.nombre, cantidad: r.cantidad, monto: r.ingresos }));
}

export async function getRankingProductos(idBarberia: string, desde: string, hasta: string): Promise<RankingItem[]> {
  const rows = await rpc<{ id_producto: number; nombre: string; unidades: number; monto: number }>(
    "bi_productos", { p_barberia: idBarberia, p_desde: desde, p_hasta: hasta });
  return rows.map((r) => ({ id: r.id_producto, nombre: r.nombre, cantidad: r.unidades, monto: r.monto }));
}
