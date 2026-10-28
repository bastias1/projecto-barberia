import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BitacoraLista, type FilaBitacora } from "@/components/admin/bitacora-lista";
import { Paginacion } from "@/components/admin/paginacion";
import { createClient } from "@/utils/supabase/server";
import { cn } from "@/lib/utils";

const POR_PAGINA = 30;
const FILTROS = [
  { clave: "", label: "Todo" },
  { clave: "barberia", label: "Barberías" },
  { clave: "plan", label: "Planes" },
  { clave: "usuario", label: "Usuarios" },
];

export default async function AdminActividad({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; pagina?: string }>;
}) {
  const { entidad = "", pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number(paginaParam) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("auditoria_admin")
    .select("id, accion, entidad, id_entidad, detalle, created_at, usuario:usuario!auditoria_admin_id_usuario_fkey (nombre, apellido)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (FILTROS.some((f) => f.clave && f.clave === entidad)) query = query.eq("entidad", entidad);
  const { data, count } = await query;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actividad</h1>
        <p className="text-muted-foreground">Cambios hechos desde este panel. No se pueden editar ni borrar.</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <Link
            key={f.clave || "todo"}
            href={f.clave ? `/admin/actividad?entidad=${f.clave}` : "/admin/actividad"}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              entidad === f.clave ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <BitacoraLista filas={conNombres} />
        </CardContent>
      </Card>

      <Paginacion pagina={pagina} totalPaginas={Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))} params={{ entidad }} base="/admin/actividad" />
    </div>
  );
}
