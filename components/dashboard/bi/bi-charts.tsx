"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Gauge, Receipt, TrendingUp, UserX, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCLP, formatFecha } from "@/lib/datetime";
import type {
  DemandaCelda, Granularidad, IngresoPeriodo, Ocupacion, RankingItem, ResumenMes,
} from "@/lib/services/bi-service";

export const COLOR_SERVICIOS = "#ec4899";
export const COLOR_PRODUCTOS = "#6366f1";

// Recharts pinta tooltip y ejes con colores fijos: los atamos al tema para que se lean en modo oscuro
const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--card-foreground)",
};
const CURSOR = { fill: "var(--muted)", opacity: 0.5 };

export function KpiTiles({ items }: { items: { label: string; valor: string; detalle: string; icon: "ingresos" | "transacciones" | "ticket" | "noshow" }[] }) {
  const iconos: Record<string, LucideIcon> = { ingresos: TrendingUp, transacciones: Receipt, ticket: Gauge, noshow: UserX };
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => {
        const Icon = iconos[k.icon];
        return (
          <li key={k.label}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">{k.label}</span>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">{k.valor}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.detalle}</p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function ChartCard({ titulo, descripcion, vacio, children }: {
  titulo: string; descripcion?: string; vacio: boolean; children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
      </CardHeader>
      <CardContent>
        {vacio ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-50" aria-hidden="true" />
            <p className="text-sm">Sin datos suficientes para este período.</p>
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

function etiquetaPeriodo(fecha: string, gran: Granularidad) {
  if (gran === "month") return formatFecha(fecha, "MMM yyyy");
  if (gran === "week") return `Sem. ${formatFecha(fecha, "dd MMM")}`;
  return formatFecha(fecha, "dd MMM");
}

export function IngresosChart({ datos, gran }: { datos: IngresoPeriodo[]; gran: Granularidad }) {
  const total = datos.reduce((s, d) => s + d.total, 0);
  return (
    <ChartCard titulo="Ingresos" descripcion={`Total del período: ${formatCLP(total)}`} vacio={datos.length === 0}>
      <div className="h-64 sm:h-80" role="img" aria-label="Gráfico de ingresos por período, servicios y productos">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos.map((d) => ({ ...d, etiqueta: etiquetaPeriodo(d.periodo, gran) }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="etiqueta" tick={TICK} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => formatCLP(v)} width={84} />
            <Tooltip formatter={(v) => formatCLP(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="servicios" name="Servicios" stackId="a" fill={COLOR_SERVICIOS} />
            <Bar dataKey="productos" name="Productos" stackId="a" fill={COLOR_PRODUCTOS} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function RankingChart({ titulo, descripcion, unidad, datos, color }: {
  titulo: string; descripcion: string; unidad: string; datos: RankingItem[]; color: string;
}) {
  const top = datos.slice(0, 10);
  return (
    <ChartCard titulo={titulo} descripcion={descripcion} vacio={top.length === 0}>
      <div className="h-72" role="img" aria-label={titulo}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" tick={TICK} tickLine={false} axisLine={false} width={110} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE} cursor={CURSOR}
              formatter={(v, n, p) => n === unidad ? [`${v} (${formatCLP(p.payload.monto)})`, unidad] : [v, n]}
            />
            <Bar dataKey="cantidad" name={unidad} fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // semana de lunes a domingo

export function DemandaChart({ datos }: { datos: DemandaCelda[] }) {
  const porDia = ORDEN_DIAS.map((d) => ({
    dow: d, total: datos.filter((c) => c.dow === d).reduce((s, c) => s + c.citas, 0),
  }));
  // Un día cerrado (0 citas) no cuenta como "menor demanda"
  const conCitas = porDia.filter((d) => d.total > 0);
  const mayor = conCitas.reduce((a, b) => (b.total > a.total ? b : a), conCitas[0]);
  const menor = conCitas.reduce((a, b) => (b.total < a.total ? b : a), conCitas[0]);
  const hMin = Math.min(...datos.map((c) => c.hora));
  const horas = datos.length ? Array.from({ length: Math.max(...datos.map((c) => c.hora)) - hMin + 1 }, (_, i) => hMin + i) : [];
  const max = Math.max(1, ...datos.map((c) => c.citas));
  const citas = (dow: number, hora: number) => datos.find((c) => c.dow === dow && c.hora === hora)?.citas ?? 0;

  return (
    <ChartCard
      titulo="Demanda por día y hora"
      descripcion={mayor ? `Mayor demanda: ${DIAS[mayor.dow]} (${mayor.total}) · Menor: ${DIAS[menor.dow]} (${menor.total})` : "Citas no canceladas"}
      vacio={datos.length === 0}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">Citas por día de la semana y hora</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="p-1 text-left font-medium">Día</th>
              {horas.map((h) => <th key={h} scope="col" className="p-1 font-medium">{h}h</th>)}
              <th scope="col" className="p-1 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {porDia.map(({ dow, total }) => (
              <tr key={dow}>
                <th scope="row" className="whitespace-nowrap p-1 text-left font-medium">{DIAS[dow]}</th>
                {horas.map((h) => {
                  const n = citas(dow, h);
                  return (
                    <td key={h} className="p-0">
                      <div
                        className="rounded py-2 text-center tabular-nums"
                        title={`${DIAS[dow]} ${h}h: ${n} citas`}
                        style={{ backgroundColor: n ? `color-mix(in srgb, ${COLOR_SERVICIOS} ${15 + (n / max) * 85}%, transparent)` : "var(--muted)" }}
                      >
                        {n || ""}
                      </div>
                    </td>
                  );
                })}
                <td className="p-1 text-center font-semibold tabular-nums">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        Menos
        <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(to right, color-mix(in srgb, ${COLOR_SERVICIOS} 15%, transparent), ${COLOR_SERVICIOS})` }} aria-hidden="true" />
        Más citas
      </p>
    </ChartCard>
  );
}

export function OcupacionChart({ datos }: { datos: Ocupacion[] }) {
  const filas = datos.map((o) => ({
    nombre: o.nombre, porcentaje: o.publicados > 0 ? Math.round((o.reservados / o.publicados) * 100) : 0,
  }));
  return (
    <ChartCard titulo="Ocupación de agenda" descripcion="Minutos reservados sobre minutos de atención publicados" vacio={filas.length === 0}>
      <div className="h-72" role="img" aria-label="Ocupación de agenda por profesional">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="nombre" tick={TICK} tickLine={false} axisLine={false} width={90} />
            <Tooltip formatter={(v) => `${v}%`} contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
            <Bar dataKey="porcentaje" name="Ocupación" fill={COLOR_PRODUCTOS} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ResumenMensualTabla({ datos }: { datos: ResumenMes[] }) {
  return (
    <ChartCard titulo="Ticket promedio e inasistencia" descripcion="Por mes · inasistencia = no asistidas / (completadas + no asistidas)" vacio={datos.length === 0}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="p-2 font-medium">Mes</th>
              <th scope="col" className="p-2 text-right font-medium">Ingresos</th>
              <th scope="col" className="p-2 text-right font-medium">Transacciones</th>
              <th scope="col" className="p-2 text-right font-medium">Ticket promedio</th>
              <th scope="col" className="p-2 text-right font-medium">Inasistencia</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {datos.map((m) => (
              <tr key={m.mes} className="border-t">
                <th scope="row" className="p-2 text-left font-medium capitalize">{formatFecha(m.mes, "MMMM yyyy")}</th>
                <td className="p-2 text-right">{formatCLP(m.ingresos)}</td>
                <td className="p-2 text-right">{m.transacciones}</td>
                <td className="p-2 text-right">{m.ticket == null ? "—" : formatCLP(m.ticket)}</td>
                <td className="p-2 text-right">{m.tasaNoShow == null ? "—" : `${m.tasaNoShow}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
