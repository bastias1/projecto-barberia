import type { SupabaseClient } from "@supabase/supabase-js";

export interface Plan {
  id_plan: number;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  activo: boolean;
  modulos: string[];                    // códigos: 'ecommerce', 'bi'
  limites: Record<string, number | null>; // max_sucursales, max_profesionales, max_productos (null = sin límite)
}

// Días de prueba que da registrar_barberia por defecto
export const DIAS_PRUEBA = 14;

/** Mercado Pago no acepta preapprovals menores a este monto en CLP. */
export const MONTO_MINIMO_SUSCRIPCION = 950;

export const MODULO_LABEL: Record<string, string> = {
  agenda: "Agenda y reservas en línea",
  ecommerce: "Tienda en línea con Mercado Pago",
  bi: "Estadísticas y predicción de demanda",
  calendario: "Sincronización con Google Calendar",
  pronostico: "Pronóstico de demanda",
};

/** Planes con sus módulos y límites. Por defecto solo los activos (catálogo público). */
export async function getPlanes(supabase: SupabaseClient, { incluirInactivos = false } = {}): Promise<Plan[]> {
  let query = supabase
    .from("plan_suscripcion")
    .select(`
      id_plan, nombre, descripcion, precio_mensual, activo,
      plan_modulo (modulo (codigo)),
      plan_limite (valor, tipo_limite (codigo))
    `)
    .order("precio_mensual", { ascending: true });
  if (!incluirInactivos) query = query.eq("activo", true);
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching planes:", error);
    return [];
  }

  const first = <T,>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T | null;

  return (data ?? []).map((p) => ({
    id_plan: p.id_plan,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio_mensual: Number(p.precio_mensual),
    activo: p.activo,
    modulos: (p.plan_modulo ?? []).flatMap((pm) => {
      const codigo = first<{ codigo: string }>(pm.modulo)?.codigo;
      return codigo ? [codigo] : [];
    }),
    limites: Object.fromEntries(
      (p.plan_limite ?? []).flatMap((pl) => {
        const codigo = first<{ codigo: string }>(pl.tipo_limite)?.codigo;
        return codigo ? [[codigo, pl.valor as number | null]] : [];
      })
    ),
  }));
}

/** "Hasta 2 barberos" o el texto sin límite ("Barberos ilimitados"), según el plan. */
export function describirLimite(valor: number | null | undefined, singular: string, plural: string, ilimitado: string): string {
  if (valor === null || valor === undefined) return ilimitado;
  return `Hasta ${valor} ${valor === 1 ? singular : plural}`;
}

/** Características de un plan para mostrarlas en la tarjeta de precios. */
export function caracteristicasPlan(plan: Plan): string[] {
  const items = [
    MODULO_LABEL.agenda,
    describirLimite(plan.limites.max_sucursales, "sucursal", "sucursales", "Sucursales ilimitadas"),
    describirLimite(plan.limites.max_profesionales, "barbero", "barberos", "Barberos ilimitados"),
    "Correos de confirmación y reseñas",
  ];
  if (plan.modulos.includes("ecommerce")) {
    items.push(MODULO_LABEL.ecommerce);
    if (plan.limites.max_productos !== 0) {
      items.push(describirLimite(plan.limites.max_productos, "producto", "productos", "Productos ilimitados"));
    }
  }
  if (plan.modulos.includes("bi")) items.push(MODULO_LABEL.bi);
  if (plan.modulos.includes("calendario")) items.push(MODULO_LABEL.calendario);
  if (plan.modulos.includes("pronostico")) items.push(MODULO_LABEL.pronostico);
  return items;
}
