import Link from "next/link";
import { AlertTriangle, CalendarCheck, DollarSign, Receipt, Store, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/server";
import { calcularMRR, conteosBarberias, getBarberiasAdmin, haceDias, inicioMes, pruebasPorVencer } from "@/lib/admin-datos";
import { formatCLP, formatFecha } from "@/lib/datetime";
import { one } from "@/lib/utils";

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

export default async function AdminResumen() {
  const supabase = await createClient();
  const hace30 = haceDias(30);

  const [barberias, { count: usuarios }, { count: usuariosNuevos }, conteos, { data: pagosMes }, { data: ultimosPagos }] = await Promise.all([
    getBarberiasAdmin(supabase),
    supabase.from("usuario").select("id_usuario", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("usuario").select("id_usuario", { count: "exact", head: true }).gte("created_at", hace30),
    conteosBarberias(supabase),
    supabase.from("pago").select("monto").eq("concepto", "suscripcion").eq("estado", "aprobado").gte("created_at", inicioMes()),
    supabase
      .from("pago")
      .select("id_pago, monto, estado, created_at, barberia:barberia!pago_id_barberia_fkey (id_barberia, nombre)")
      .eq("concepto", "suscripcion")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const porEstado = (clave: string) => barberias.filter((b) => b.estado.clave === clave).length;
  const pagando = porEstado("activa_mp") + porEstado("activa");
  const cobradoMes = (pagosMes ?? []).reduce((t, p) => t + Number(p.monto), 0);
  const porVencer = pruebasPorVencer(barberias);

  // Barberías nuevas por mes (últimos 6 meses)
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const nuevasPorMes = meses.map((m) => ({ mes: m, total: barberias.filter((b) => b.created_at.slice(0, 7) === m).length }));
  const maxNuevas = Math.max(1, ...nuevasPorMes.map((m) => m.total));

  const tarjetas = [
    { titulo: "Barberías", valor: barberias.length, detalle: `${pagando} pagando · ${porEstado("prueba")} en prueba · ${porEstado("vencida")} vencidas`, icon: Store },
    { titulo: "Ingreso mensual (MRR)", valor: formatCLP(calcularMRR(barberias)), detalle: `${porEstado("cortesia")} en cortesía`, icon: DollarSign },
    { titulo: "Cobrado este mes", valor: formatCLP(cobradoMes), detalle: `${pagosMes?.length ?? 0} pagos de suscripción`, icon: Receipt },
    { titulo: "Usuarios", valor: usuarios ?? 0, detalle: `${usuariosNuevos ?? 0} nuevos en 30 días`, icon: Users },
    { titulo: "Reservas del mes", valor: conteos.reduce((t, c) => t + c.reservas_mes, 0), detalle: "En todas las barberías", icon: CalendarCheck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Resumen</h1>
        <p className="text-muted-foreground">Estado de la plataforma</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <Card key={t.titulo} className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-accent"><t.icon className="size-4" /></span>
            </CardHeader>
            <CardContent>
              <div className="display text-3xl tabular-nums">{t.valor}</div>
              <p className="text-xs text-muted-foreground mt-1">{t.detalle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-muted-foreground" aria-hidden="true" />Pruebas por vencer (7 días)</CardTitle>
            <CardDescription>Buen momento para contactarlas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {porVencer.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna prueba vence esta semana.</p>
            ) : (
              porVencer.map((b) => (
                <Link key={b.id_barberia} href={`/admin/barberias/${b.id_barberia}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors">
                  <div>
                    <p className="font-medium">{b.nombre}</p>
                    <p className="text-xs text-muted-foreground">{b.duenos[0]?.email ?? "Sin administrador"} · plan {b.plan}</p>
                  </div>
                  <Badge variant="secondary">Vence el {formatFecha(b.suscripcion!.fecha_termino!, "d MMM")}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Barberías nuevas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {nuevasPorMes.map((m) => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium">{m.total}</span>
                  <div className="w-full rounded-t bg-brand" style={{ height: `${(m.total / maxNuevas) * 80 + 4}px` }} />
                  <span className="text-[10px] text-muted-foreground capitalize">{formatFecha(`${m.mes}-01`, "MMM")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Últimos pagos de suscripción</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!ultimosPagos?.length ? (
              <p className="text-sm text-muted-foreground">Aún no hay pagos.</p>
            ) : (
              ultimosPagos.map((p) => {
                const b = one<{ id_barberia: string; nombre: string }>(p.barberia);
                return (
                  <div key={p.id_pago} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <Link href={`/admin/barberias/${b?.id_barberia}`} className="hover:underline">{b?.nombre}</Link>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fechaCorta(p.created_at)}</span>
                      {formatCLP(Number(p.monto))}
                      <Badge variant={p.estado === "aprobado" ? "default" : p.estado === "rechazado" ? "destructive" : "secondary"}>{p.estado}</Badge>
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Registradas recientemente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {barberias.slice(0, 6).map((b) => (
              <Link key={b.id_barberia} href={`/admin/barberias/${b.id_barberia}`} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0 hover:underline">
                <span>{b.nombre}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{fechaCorta(b.created_at)}</span>
                  <Badge variant={b.estado.tono}>{b.estado.label}</Badge>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
