import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { ModuloNoDisponible } from "@/components/modulo-no-disponible";
import { addDays, formatCLP, formatFecha, todayIn } from "@/lib/datetime";
import {
  getDemanda, getIngresos, getOcupacion, getOpcionesFiltro, getRankingProductos, getRankingServicios, getResumenMensual,
  type Granularidad, type Rango,
} from "@/lib/services/bi-service";
import { KpiTiles } from "@/components/dashboard/bi/bi-charts";
import {
  DemandaPanel, IngresosPanel, OcupacionPanel, ProductosPanel, ResumenPanel, ServiciosPanel,
} from "@/components/dashboard/bi/paneles";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 731;
const GRANULARIDADES: { valor: Granularidad; label: string }[] = [
  { valor: "day", label: "Día" }, { valor: "week", label: "Semana" }, { valor: "month", label: "Mes" },
];

type SearchParams = { desde?: string; hasta?: string; gran?: string };

export default async function EstadisticasPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<SearchParams>;
}) {
  const slug = (await params).slug;
  // El admin ve todo; un profesional solo sus métricas y sin productos (lo fuerza la BD)
  const ctx = await requireStaff(slug);
  const esAdmin = ctx.isAdmin;
  if (!(await getModulosCached(ctx.barberia.id_barberia)).includes("bi")) {
    return (
      <ModuloNoDisponible
        titulo="Las estadísticas no están incluidas en tu plan"
        descripcion="Cambia a un plan que lo incluya para activarlo."
        volverHref={`/${slug}/dashboard/suscripcion`}
        volverLabel="Ver planes"
      />
    );
  }

  const sp = await searchParams;
  const hoy = todayIn();
  let desde = sp.desde && FECHA.test(sp.desde) ? sp.desde : addDays(hoy, -29);
  let hasta = sp.hasta && FECHA.test(sp.hasta) ? sp.hasta : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const recortado = desde < addDays(hasta, -MAX_DIAS);
  if (recortado) desde = addDays(hasta, -MAX_DIAS);
  const gran = GRANULARIDADES.find((g) => g.valor === sp.gran)?.valor ?? "day";

  const id = ctx.barberia.id_barberia;
  const base = `/${slug}/dashboard/estadisticas`;
  const presets = [
    { label: "7 días", desde: addDays(hoy, -6), gran: "day" },
    { label: "30 días", desde: addDays(hoy, -29), gran: "day" },
    { label: "6 meses", desde: addDays(hoy, -182), gran: "month" },
  ].map((p) => ({ ...p, activo: p.desde === desde && hasta === hoy && p.gran === gran }));

  const rango: Rango = { desde, hasta, gran };
  let datos;
  try {
    const [ingresos, servicios, productos, demanda, ocupacion, resumen, opciones] = await Promise.all([
      getIngresos(id, rango),
      getRankingServicios(id, rango),
      esAdmin ? getRankingProductos(id, rango) : Promise.resolve([]),
      getDemanda(id, rango),
      getOcupacion(id, rango),
      getResumenMensual(id, rango),
      getOpcionesFiltro(id),
    ]);
    datos = {
      ingresos, servicios, productos, demanda, ocupacion, resumen,
      opciones: esAdmin ? opciones : { ...opciones, profesionales: [] },
    };
  } catch (error) {
    console.error("[estadisticas] no se pudieron cargar los datos:", error);
    datos = null;
  }

  // Resumen del rango completo (sin filtros de gráfico) a partir de lo que ya calculó la BD
  const kpis = datos && (() => {
    const ingresos = datos.ingresos.reduce((s, d) => s + d.total, 0);
    const transacciones = datos.ingresos.reduce((s, d) => s + d.transacciones, 0);
    const completadas = datos.resumen.reduce((s, m) => s + m.completadas, 0);
    const noAsistio = datos.resumen.reduce((s, m) => s + m.noAsistio, 0);
    const citas = completadas + noAsistio;
    return [
      { label: "Ingresos", valor: formatCLP(ingresos), detalle: esAdmin ? "Servicios + productos pagados" : "Tus servicios completados", icon: "ingresos" as const },
      { label: "Transacciones", valor: String(transacciones), detalle: esAdmin ? "Citas completadas y pedidos" : "Tus citas completadas", icon: "transacciones" as const },
      { label: "Ticket promedio", valor: transacciones ? formatCLP(ingresos / transacciones) : "—", detalle: "Ingresos por transacción", icon: "ticket" as const },
      { label: "Inasistencia", valor: citas ? `${Math.round((noAsistio / citas) * 1000) / 10}%` : "—", detalle: `${noAsistio} de ${citas} citas`, icon: "noshow" as const },
    ];
  })();

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">Estadísticas</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          {formatFecha(desde, "dd MMM yyyy")} – {formatFecha(hasta, "dd MMM yyyy")}
          {!esAdmin && " · Tus métricas"}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <nav aria-label="Períodos rápidos" className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.label} asChild variant={p.activo ? "default" : "outline"} size="sm" className="h-11 flex-1 sm:h-8 sm:flex-none">
                <Link href={`${base}?desde=${p.desde}&hasta=${hoy}&gran=${p.gran}`} aria-current={p.activo ? "true" : undefined}>
                  {p.label}
                </Link>
              </Button>
            ))}
          </nav>
          <form method="get" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" name="desde" type="date" defaultValue={desde} max={hasta} className="h-11 min-w-0 sm:h-9" />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="h-11 min-w-0 sm:h-9" />
            </div>
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label htmlFor="gran">Agrupar por</Label>
              <select id="gran" name="gran" defaultValue={gran}
                className="h-11 w-full rounded-md sm:h-9 border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {GRANULARIDADES.map((g) => <option key={g.valor} value={g.valor} className="bg-background">{g.label}</option>)}
              </select>
            </div>
            <Button type="submit" className="col-span-2 h-11 sm:col-span-1 sm:h-9">Aplicar</Button>
          </form>
        </CardContent>
      </Card>

      {recortado && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          El rango máximo es de 2 años: se muestra desde el {formatFecha(desde, "dd MMM yyyy")}.
        </p>
      )}

      {!datos || !kpis ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          No se pudieron cargar las estadísticas. Intenta de nuevo en un momento.
        </p>
      ) : (
        // key: al cambiar el rango los paneles se remontan y sus filtros se reinician
        <div key={`${desde}|${hasta}|${gran}`} className="space-y-6">
          <KpiTiles items={kpis} />
          <IngresosPanel slug={slug} rango={rango} inicial={datos.ingresos} opciones={datos.opciones} esAdmin={esAdmin} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ServiciosPanel slug={slug} rango={rango} inicial={datos.servicios} opciones={datos.opciones} esAdmin={esAdmin} />
            {esAdmin && <ProductosPanel slug={slug} rango={rango} inicial={datos.productos} opciones={datos.opciones} esAdmin />}
          </div>
          <DemandaPanel slug={slug} rango={rango} inicial={datos.demanda} opciones={datos.opciones} esAdmin={esAdmin} />
          <div className="grid gap-6 lg:grid-cols-2">
            <OcupacionPanel slug={slug} rango={rango} inicial={datos.ocupacion} opciones={datos.opciones} esAdmin={esAdmin} />
            <ResumenPanel slug={slug} rango={rango} inicial={datos.resumen} opciones={datos.opciones} esAdmin={esAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}
