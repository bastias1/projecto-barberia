import { createClient } from "@/utils/supabase/server";

/**
 * Estadísticas (módulo BI). Los cálculos viven en funciones SQL `bi_*` (ver BI.sql):
 * solo responden al admin de una barbería con el módulo `bi`.
 */

export type Granularidad = "day" | "week" | "month";

/** "propio": las métricas del barbero que mira (sin productos); "negocio": las de toda la barbería (solo admin). */
export type ModoBI = "propio" | "negocio";

/** Filtros opcionales de cada gráfico; sin valor = sin filtrar. */
export interface FiltrosBI {
  sucursal?: number;
  profesional?: string;
  servicio?: number;
  tipo?: "servicios" | "productos";
}

export interface Rango {
  desde: string;
  hasta: string;
  gran: Granularidad;
}

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

/** Datos de cada gráfico, por clave. */
export interface DatosBI {
  ingresos: IngresoPeriodo[];
  servicios: RankingItem[];
  productos: RankingItem[];
  demanda: DemandaCelda[];
  ocupacion: Ocupacion[];
  resumen: ResumenMes[];
}

export interface OpcionesFiltro {
  sucursales: { id: number; nombre: string }[];
  profesionales: { id: string; nombre: string }[];
  servicios: { id: number; nombre: string }[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

// undefined se omite del JSON y la función SQL usa su default (NULL = sin filtrar)
const base = (idBarberia: string, r: Pick<Rango, "desde" | "hasta">) =>
  ({ p_barberia: idBarberia, p_desde: r.desde, p_hasta: r.hasta });

export function getIngresos(idBarberia: string, r: Rango, f: FiltrosBI = {}) {
  return rpc<IngresoPeriodo>("bi_ingresos", {
    ...base(idBarberia, r), p_gran: r.gran, p_tipo: f.tipo,
    p_sucursal: f.sucursal, p_profesional: f.profesional, p_servicio: f.servicio,
  });
}

export async function getRankingServicios(idBarberia: string, r: Rango, f: FiltrosBI = {}): Promise<RankingItem[]> {
  const rows = await rpc<{ id_servicio: number; nombre: string; cantidad: number; ingresos: number }>(
    "bi_servicios", { ...base(idBarberia, r), p_sucursal: f.sucursal, p_profesional: f.profesional });
  return rows.map((x) => ({ id: x.id_servicio, nombre: x.nombre, cantidad: x.cantidad, monto: x.ingresos }));
}

export async function getRankingProductos(idBarberia: string, r: Rango, f: FiltrosBI = {}): Promise<RankingItem[]> {
  const rows = await rpc<{ id_producto: number; nombre: string; unidades: number; monto: number }>(
    "bi_productos", { ...base(idBarberia, r), p_sucursal: f.sucursal });
  return rows.map((x) => ({ id: x.id_producto, nombre: x.nombre, cantidad: x.unidades, monto: x.monto }));
}

export interface PuntoPronostico { fecha: string; estimado: number; min: number; max: number }
export interface Pronostico { reservas: PuntoPronostico[]; ingresos: PuntoPronostico[]; mape: number | null }

/** HU-25: lo que dejó ml/pronostico.py (RLS: solo admin con el módulo `pronostico`). Vacío = "aún no disponible". */
export async function getPronostico(idBarberia: string, desde: string): Promise<Pronostico> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("prediccion_demanda")
    .select("tipo, fecha_objetivo, valor_estimado, valor_min, valor_max, mape")
    .eq("id_barberia", idBarberia).in("tipo", ["reservas", "ingresos"]).gte("fecha_objetivo", desde)
    .order("fecha_objetivo");
  if (error) throw new Error(error.message);
  const punto = (r: NonNullable<typeof data>[number]): PuntoPronostico => ({
    fecha: r.fecha_objetivo, estimado: Number(r.valor_estimado),
    min: Number(r.valor_min ?? r.valor_estimado), max: Number(r.valor_max ?? r.valor_estimado),
  });
  const filas = data ?? [];
  const mapes = filas.flatMap((r) => (r.mape == null ? [] : [Number(r.mape)]));
  return {
    reservas: filas.filter((r) => r.tipo === "reservas").map(punto),
    ingresos: filas.filter((r) => r.tipo === "ingresos").map(punto),
    mape: mapes.length ? Math.max(...mapes) : null,
  };
}

export function getDemanda(idBarberia: string, r: Rango, f: FiltrosBI = {}) {
  return rpc<DemandaCelda>("bi_demanda", {
    ...base(idBarberia, r), p_sucursal: f.sucursal, p_profesional: f.profesional, p_servicio: f.servicio,
  });
}

export async function getOcupacion(idBarberia: string, r: Rango, f: FiltrosBI = {}): Promise<Ocupacion[]> {
  const rows = await rpc<{ id_profesional: string; nombre: string; minutos_publicados: number; minutos_reservados: number }>(
    "bi_ocupacion", { ...base(idBarberia, r), p_sucursal: f.sucursal, p_profesional: f.profesional });
  return rows.map((x) => ({
    id: x.id_profesional, nombre: x.nombre, publicados: x.minutos_publicados, reservados: x.minutos_reservados,
  }));
}

export async function getResumenMensual(idBarberia: string, r: Rango, f: FiltrosBI = {}): Promise<ResumenMes[]> {
  const rows = await rpc<{
    mes: string; ingresos: number; transacciones: number; ticket_promedio: number | null;
    completadas: number; no_asistio: number; tasa_no_show: number | null;
  }>("bi_resumen_mensual", {
    ...base(idBarberia, r), p_sucursal: f.sucursal, p_profesional: f.profesional, p_servicio: f.servicio,
  });
  return rows.map((x) => ({
    mes: x.mes, ingresos: x.ingresos, transacciones: x.transacciones, ticket: x.ticket_promedio,
    completadas: x.completadas, noAsistio: x.no_asistio, tasaNoShow: x.tasa_no_show,
  }));
}

/** Sucursales, profesionales y servicios de la barbería para armar los selectores (incluye inactivos: hay historial). */
export async function getOpcionesFiltro(idBarberia: string): Promise<OpcionesFiltro> {
  const supabase = await createClient();
  const [suc, pro, ser] = await Promise.all([
    supabase.from("sucursal").select("id:id_sucursal, nombre").eq("id_barberia", idBarberia).order("id_sucursal"),
    supabase.rpc("profesionales_publicos", { p_barberia: idBarberia }),
    supabase.from("servicio").select("id:id_servicio, nombre").eq("id_barberia", idBarberia).order("nombre"),
  ]);
  const error = suc.error ?? pro.error ?? ser.error;
  if (error) throw new Error(error.message);
  return {
    sucursales: (suc.data ?? []) as OpcionesFiltro["sucursales"],
    profesionales: ((pro.data ?? []) as { id_profesional: string; nombre_visible: string }[])
      .map((p) => ({ id: p.id_profesional, nombre: p.nombre_visible })),
    servicios: (ser.data ?? []) as OpcionesFiltro["servicios"],
  };
}

/** Carga los datos de un gráfico con sus filtros. */
export function cargarDatos<K extends keyof DatosBI>(
  idBarberia: string, grafico: K, r: Rango, f: FiltrosBI,
): Promise<DatosBI[K]> {
  const cargadores: { [P in keyof DatosBI]: () => Promise<DatosBI[P]> } = {
    ingresos: () => getIngresos(idBarberia, r, f),
    servicios: () => getRankingServicios(idBarberia, r, f),
    productos: () => getRankingProductos(idBarberia, r, f),
    demanda: () => getDemanda(idBarberia, r, f),
    ocupacion: () => getOcupacion(idBarberia, r, f),
    resumen: () => getResumenMensual(idBarberia, r, f),
  };
  return cargadores[grafico]();
}
