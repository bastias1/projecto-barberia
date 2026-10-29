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
  getDemanda, getIngresos, getOcupacion, getRankingProductos, getRankingServicios, getResumenMensual,
  type Granularidad,
} from "@/lib/services/bi-service";
import {
  DemandaChart, IngresosChart, KpiTiles, OcupacionChart, RankingChart, ResumenMensualTabla,
  COLOR_PRODUCTOS, COLOR_SERVICIOS,
} from "@/components/dashboard/bi/bi-charts";

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
  const ctx = await requireStaff(slug, { admin: true });
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

  let datos;
  try {
    datos = await Promise.all([
      getIngresos(id, desde, hasta, gran),
      getRankingServicios(id, desde, hasta),
      getRankingProductos(id, desde, hasta),
      getDemanda(id, desde, hasta),
      getOcupacion(id, desde, hasta),
      getResumenMensual(id, desde, hasta),
    ]);
  } catch (error) {
    console.error("[estadisticas] no se pudieron cargar los datos:", error);
    datos = null;
  }

  // Resumen del rango completo a partir de lo que ya calculó la BD
  const kpis = datos && (() => {
    const ingresos = datos[0].reduce((s, d) => s + d.total, 0);
    const transacciones = datos[0].reduce((s, d) => s + d.transacciones, 0);
    const completadas = datos[5].reduce((s, m) => s + m.completadas, 0);
    const noAsistio = datos[5].reduce((s, m) => s + m.noAsistio, 0);
    const citas = completadas + noAsistio;
    return [
      { label: "Ingresos", valor: formatCLP(ingresos), detalle: "Servicios + productos pagados", icon: "ingresos" as const },
      { label: "Transacciones", valor: String(transacciones), detalle: "Citas completadas y pedidos", icon: "transacciones" as const },
      { label: "Ticket promedio", valor: transacciones ? formatCLP(ingresos / transacciones) : "—", detalle: "Ingresos por transacción", icon: "ticket" as const },
      { label: "Inasistencia", valor: citas ? `${Math.round((noAsistio / citas) * 1000) / 10}%` : "—", detalle: `${noAsistio} de ${citas} citas`, icon: "noshow" as const },
    ];
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">Estadísticas</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          {formatFecha(desde, "dd MMM yyyy")} – {formatFecha(hasta, "dd MMM yyyy")}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <nav aria-label="Períodos rápidos" className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.label} asChild variant={p.activo ? "default" : "outline"} size="sm">
                <Link href={`${base}?desde=${p.desde}&hasta=${hoy}&gran=${p.gran}`} aria-current={p.activo ? "true" : undefined}>
                  {p.label}
                </Link>
              </Button>
            ))}
          </nav>
          <form method="get" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" name="desde" type="date" defaultValue={desde} max={hasta} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
            </div>
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label htmlFor="gran">Agrupar por</Label>
              <select id="gran" name="gran" defaultValue={gran}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {GRANULARIDADES.map((g) => <option key={g.valor} value={g.valor} className="bg-background">{g.label}</option>)}
              </select>
            </div>
            <Button type="submit" className="col-span-2 sm:col-span-1">Aplicar</Button>
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
        <div className="space-y-6">
          <KpiTiles items={kpis} />
          <IngresosChart datos={datos[0]} gran={gran} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RankingChart titulo="Servicios más realizados" descripcion="Citas completadas" unidad="Citas"
              datos={datos[1]} color={COLOR_SERVICIOS} />
            <RankingChart titulo="Productos más vendidos" descripcion="Unidades en pedidos pagados" unidad="Unidades"
              datos={datos[2]} color={COLOR_PRODUCTOS} />
          </div>
          <DemandaChart datos={datos[3]} />
          <div className="grid gap-6 lg:grid-cols-2">
            <OcupacionChart datos={datos[4]} />
            <ResumenMensualTabla datos={datos[5]} />
          </div>
        </div>
      )}
    </div>
  );
}
