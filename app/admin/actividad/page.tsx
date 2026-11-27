import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BitacoraLista, type FilaBitacora } from "@/components/admin/bitacora-lista";
import { Paginacion } from "@/components/admin/paginacion";
import { FiltroFacetado, FiltroFechas, LimpiarFiltros } from "@/components/admin/filtros";
import { createClient } from "@/utils/supabase/server";
import { ACCION_LABEL } from "@/lib/superadmin";
import { lista } from "@/lib/admin-filtros";
import { addDays, fromZoned } from "@/lib/datetime";
import { DEFAULT_TZ } from "@/lib/barberia";
import { one } from "@/lib/utils";

const POR_PAGINA = 30;
const ENTIDADES = [
  { valor: "barberia", label: "Barberías" },
  { valor: "plan", label: "Planes" },
  { valor: "usuario", label: "Usuarios" },
];
// Entidad de cada acción (app/admin/actions.ts), para ofrecer solo las de las entidades elegidas
const entidadDe = (accion: string) =>
  accion.endsWith("_plan") ? "plan" : accion.endsWith("_usuario") || accion.endsWith("superadmin") || accion === "eliminar_datos" ? "usuario" : "barberia";
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fecha = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminActividad({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; accion?: string; quien?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const entidades = lista(params.entidad).filter((e) => ENTIDADES.some((x) => x.valor === e));
  const acciones = lista(params.accion).filter((a) => a in ACCION_LABEL);
  const quienes = lista(params.quien);
  const supabase = await createClient();

  let query = supabase
    .from("auditoria_admin")
    .select("id, accion, entidad, id_entidad, detalle, created_at, usuario:usuario!auditoria_admin_id_usuario_fkey (nombre, apellido)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (entidades.length) query = query.in("entidad", entidades as FilaBitacora["entidad"][]);
  if (acciones.length) query = query.in("accion", acciones);
  if (quienes.length) query = query.in("id_usuario", quienes);
  // Días completos en la hora de Chile
  if (params.desde && fecha.test(params.desde)) query = query.gte("created_at", fromZoned(params.desde, "00:00", DEFAULT_TZ).toISOString());
  if (params.hasta && fecha.test(params.hasta)) query = query.lt("created_at", fromZoned(addDays(params.hasta, 1), "00:00", DEFAULT_TZ).toISOString());

  const [{ data, count }, { data: autores }] = await Promise.all([
    query,
    // shortcut: los autores salen de las últimas 1000 filas (tope de PostgREST); pasar a una RPC con DISTINCT si la bitácora crece mucho
    supabase
      .from("auditoria_admin")
      .select("id_usuario, usuario:usuario!auditoria_admin_id_usuario_fkey (nombre, apellido)")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  // Nombres de las barberías y planes afectados, para mostrarlos en cada fila
  const filas = (data ?? []) as FilaBitacora[];
  const idsBarberia = filas.filter((f) => f.entidad === "barberia").map((f) => f.id_entidad);
  const idsPlan = filas.filter((f) => f.entidad === "plan").map((f) => Number(f.id_entidad));
  const [{ data: barberias }, { data: planes }] = await Promise.all([
    idsBarberia.length ? supabase.from("barberia").select("id_barberia, nombre").in("id_barberia", idsBarberia) : Promise.resolve({ data: [] }),
    idsPlan.length ? supabase.from("plan_suscripcion").select("id_plan, nombre").in("id_plan", idsPlan) : Promise.resolve({ data: [] }),
  ]);
  const nombres = new Map<string, string>([
    ...(barberias ?? []).map((b) => [`barberia:${b.id_barberia}`, b.nombre] as [string, string]),
    ...(planes ?? []).map((p) => [`plan:${p.id_plan}`, p.nombre] as [string, string]),
  ]);
  const conNombres = filas.map((f) => ({ ...f, objetivo: nombres.get(`${f.entidad}:${f.id_entidad}`) ?? null }));

  const opcionesQuien = [
    ...new Map(
      (autores ?? []).filter((a) => a.id_usuario).map((a) => {
        const u = one<{ nombre: string; apellido: string | null }>(a.usuario);
        return [a.id_usuario!, u ? [u.nombre, u.apellido].filter(Boolean).join(" ") : "Sin nombre"] as [string, string];
      })
    ),
  ].map(([valor, label]) => ({ valor, label }));
  const opcionesAccion = Object.entries(ACCION_LABEL)
    .filter(([a]) => entidades.length === 0 || entidades.includes(entidadDe(a)))
    .map(([valor, label]) => ({ valor, label: mayuscula(label.replace(/ (a|de)$/, "")) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Actividad</h1>
        <p className="text-muted-foreground">Cambios hechos desde este panel. No se pueden editar ni borrar.</p>
      </div>

      <Suspense>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroFacetado param="entidad" titulo="Sobre" opciones={ENTIDADES} />
          <FiltroFacetado param="accion" titulo="Acción" opciones={opcionesAccion} />
          {opcionesQuien.length > 1 && <FiltroFacetado param="quien" titulo="Hecho por" opciones={opcionesQuien} />}
          <FiltroFechas titulo="Fecha" />
          <LimpiarFiltros params={["entidad", "accion", "quien", "desde", "hasta"]} />
        </div>
      </Suspense>

      <Card>
        <CardContent className="p-6">
          <BitacoraLista filas={conNombres} />
        </CardContent>
      </Card>

      <Paginacion
        pagina={pagina}
        totalPaginas={Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))}
        params={{ entidad: params.entidad, accion: params.accion, quien: params.quien, desde: params.desde, hasta: params.hasta }}
        base="/admin/actividad"
      />
    </div>
  );
}
