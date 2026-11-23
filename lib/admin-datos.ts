import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TZ } from "./barberia";
import { addDays, fromZoned, todayIn } from "./datetime";
import { estadoSuscripcion as clasificar, type ClaveEstado } from "./suscripcion";
import { one, todasLasFilas } from "./utils";

/* Consultas del panel de plataforma (/admin). Corren con la sesión del superadmin (RLS *_superadmin). */

export type EstadoClave = ClaveEstado;

export interface EstadoSuscripcion {
  clave: EstadoClave;
  label: string;
  tono: "default" | "secondary" | "destructive" | "outline";
}

export interface SuscripcionResumen {
  id_suscripcion: number;
  id_plan: number;
  estado: string;
  fecha_termino: string | null;
  precio_pactado: number;
  id_suscripcion_externa: string | null;
}

const hoy = () => todayIn(DEFAULT_TZ);

const PRESENTACION: Record<ClaveEstado, Pick<EstadoSuscripcion, "label" | "tono">> = {
  suspendida: { label: "Suspendida", tono: "destructive" },
  sin: { label: "Sin suscripción", tono: "outline" },
  vencida: { label: "Vencida", tono: "destructive" },
  prueba: { label: "En prueba", tono: "secondary" },
  activa_mp: { label: "Activa (Mercado Pago)", tono: "default" },
  cortesia: { label: "Activa (cortesía)", tono: "default" },
  activa: { label: "Activa (sin vencimiento)", tono: "default" },
};

/** Estado de una barbería para el panel: la clasificación es de `lib/suscripcion.ts`; aquí solo el texto. */
export function estadoSuscripcion(sus: SuscripcionResumen | null, barberiaActiva: boolean): EstadoSuscripcion {
  const { clave } = clasificar(sus, { barberiaActiva });
  const label = clave === "vencida" && sus?.estado === "prueba" ? "Prueba vencida" : PRESENTACION[clave].label;
  return { clave, label, tono: PRESENTACION[clave].tono };
}

export interface FilaBarberia {
  id_barberia: string;
  nombre: string;
  slug: string;
  activa: boolean;
  created_at: string;
  suscripcion: SuscripcionResumen | null;
  plan: string | null;
  estado: EstadoSuscripcion;
  duenos: { nombre: string; email: string }[];
  barberos: number;
  reservasMes: number;
}

/** Inicio del mes actual (UTC ISO) según la zona de la plataforma. */
export function inicioMes(): string {
  return fromZoned(`${hoy().slice(0, 7)}-01`, "00:00", DEFAULT_TZ).toISOString();
}

/** Instante de hace `dias` días (ISO), para filtrar por created_at. */
export function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

/** Todas las barberías con su suscripción vigente, dueños y uso (escala: decenas o cientos). */
export async function getBarberiasAdmin(supabase: SupabaseClient): Promise<FilaBarberia[]> {
  const [{ data: barberias }, { data: planes }, { data: equipo }, { data: profesionales }, { data: reservas }] = await Promise.all([
    supabase
      .from("barberia")
      .select(`id_barberia, nombre, slug, activa, created_at,
        suscripcion:suscripcion!suscripcion_id_barberia_fkey (id_suscripcion, id_plan, estado, fecha_termino, precio_pactado, id_suscripcion_externa)`)
      .order("created_at", { ascending: false }),
    supabase.from("plan_suscripcion").select("id_plan, nombre"),
    supabase
      .from("usuario_barberia")
      .select("id_barberia, usuario:usuario!usuario_barberia_id_usuario_fkey (nombre, apellido, email)")
      .eq("rol", "admin")
      .eq("activo", true),
    supabase.from("profesional").select("id_barberia").eq("activo", true),
    todasLasFilas<{ id_barberia: string }>(() => supabase.from("reserva").select("id_barberia").neq("estado", "cancelada").gte("fecha_hora_inicio", inicioMes()).order("id_reserva")),
  ]);

  const nombrePlan = new Map((planes ?? []).map((p) => [p.id_plan, p.nombre]));
  const contar = (filas: { id_barberia: string }[] | null) => {
    const m = new Map<string, number>();
    for (const f of filas ?? []) m.set(f.id_barberia, (m.get(f.id_barberia) ?? 0) + 1);
    return m;
  };
  const barberos = contar(profesionales);
  const reservasMes = contar(reservas);

  return (barberias ?? []).map((b) => {
    // La suscripción más reciente es la que rige
    const lista = (Array.isArray(b.suscripcion) ? b.suscripcion : b.suscripcion ? [b.suscripcion] : []) as SuscripcionResumen[];
    const sus = lista.sort((a, c) => c.id_suscripcion - a.id_suscripcion)[0] ?? null;
    if (sus) sus.precio_pactado = Number(sus.precio_pactado);
    return {
      id_barberia: b.id_barberia,
      nombre: b.nombre,
      slug: b.slug,
      activa: b.activa,
      created_at: b.created_at,
      suscripcion: sus,
      plan: sus ? nombrePlan.get(sus.id_plan) ?? null : null,
      estado: estadoSuscripcion(sus, b.activa),
      duenos: (equipo ?? [])
        .filter((e) => e.id_barberia === b.id_barberia)
        .map((e) => one<{ nombre: string; apellido: string | null; email: string }>(e.usuario))
        .filter((u): u is { nombre: string; apellido: string | null; email: string } => !!u)
        .map((u) => ({ nombre: [u.nombre, u.apellido].filter(Boolean).join(" "), email: u.email })),
      barberos: barberos.get(b.id_barberia) ?? 0,
      reservasMes: reservasMes.get(b.id_barberia) ?? 0,
    };
  });
}

/** Ingreso mensual recurrente: suscripciones activas y vigentes que pagan (sin pruebas ni cortesías). */
export function calcularMRR(filas: FilaBarberia[]): number {
  return filas
    .filter((f) => f.estado.clave === "activa_mp" || f.estado.clave === "activa")
    .reduce((total, f) => total + (f.suscripcion?.precio_pactado ?? 0), 0);
}

/** Pruebas que vencen dentro de `dias` días. */
export function pruebasPorVencer(filas: FilaBarberia[], dias = 7): FilaBarberia[] {
  const limite = addDays(hoy(), dias);
  return filas
    .filter((f) => f.estado.clave === "prueba" && f.suscripcion?.fecha_termino && f.suscripcion.fecha_termino <= limite)
    .sort((a, b) => (a.suscripcion!.fecha_termino! < b.suscripcion!.fecha_termino! ? -1 : 1));
}
