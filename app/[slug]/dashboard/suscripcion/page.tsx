import { CreditCard, Check, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuscripcionAcciones } from "@/components/dashboard/suscripcion-acciones";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { sincronizarCobros } from "@/lib/suscripcion";
import { caracteristicasPlan, getPlanes, MODULO_LABEL } from "@/lib/planes";
import { formatCLP, formatFecha } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const hoy = () => new Date().toISOString().slice(0, 10);

export default async function SuscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug, { admin: true });
  const idBarberia = ctx.barberia.id_barberia;
  const supabase = await createClient();

  // Respaldo del webhook: registra los cobros de Mercado Pago que aún no estén en `pago`
  const { data: conCobro } = await supabase
    .from("suscripcion")
    .select("id_suscripcion_externa")
    .eq("id_barberia", idBarberia)
    .not("id_suscripcion_externa", "is", null)
    .order("id_suscripcion", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conCobro?.id_suscripcion_externa) await sincronizarCobros(createServiceRoleClient(), conCobro.id_suscripcion_externa);

  const [{ data: sus }, planes, modulos, { data: pagos }, usos] = await Promise.all([
    supabase
      .from("suscripcion")
      .select("id_suscripcion, id_plan, estado, fecha_inicio, fecha_termino, precio_pactado, id_suscripcion_externa")
      .eq("id_barberia", idBarberia)
      .order("id_suscripcion", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getPlanes(supabase),
    getModulosCached(idBarberia),
    supabase
      .from("pago")
      .select("id_pago, monto, estado, created_at")
      .eq("id_barberia", idBarberia)
      .eq("concepto", "suscripcion")
      .order("created_at", { ascending: false })
      .limit(6),
    Promise.all([
      supabase.from("profesional").select("id_profesional", { count: "exact", head: true }).eq("id_barberia", idBarberia).eq("activo", true),
      supabase.from("sucursal").select("id_sucursal", { count: "exact", head: true }).eq("id_barberia", idBarberia).eq("activa", true),
      supabase.from("producto").select("id_producto", { count: "exact", head: true }).eq("id_barberia", idBarberia).eq("activo", true),
    ]),
  ]);

  const plan = planes.find((p) => p.id_plan === sus?.id_plan);
  const vigente = modulos.includes("agenda");
  const vencida = !!sus?.fecha_termino && sus.fecha_termino < hoy();
  const renovacionAutomatica = !!sus?.id_suscripcion_externa;
  const fecha = (f: string | null | undefined) => (f ? formatFecha(f, "d 'de' MMMM yyyy") : "");

  let estadoTexto = "Sin suscripción";
  let estadoBadge: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (sus) {
    if (!vigente || vencida || sus.estado === "vencida" || sus.estado === "cancelada") {
      estadoTexto = sus.estado === "prueba" ? `Prueba terminada el ${fecha(sus.fecha_termino)}` : "Vencida";
      estadoBadge = "destructive";
    } else if (sus.estado === "prueba") {
      estadoTexto = `Prueba gratis hasta el ${fecha(sus.fecha_termino)}`;
      estadoBadge = "secondary";
    } else if (renovacionAutomatica) {
      estadoTexto = sus.fecha_termino ? `Activa · se renueva antes del ${fecha(sus.fecha_termino)}` : "Activa · cobro mensual automático";
      estadoBadge = "default";
    } else {
      estadoTexto = sus.fecha_termino ? `Activa hasta el ${fecha(sus.fecha_termino)} (sin renovación automática)` : "Activa";
      estadoBadge = "default";
    }
  }

  const [barberos, sucursales, productos] = usos.map((u) => u.count ?? 0);
  const limite = (codigo: string) => plan?.limites[codigo] ?? null;
  const usoLimites = [
    { label: "Barberos", usados: barberos, max: limite("max_profesionales") },
    { label: "Sucursales", usados: sucursales, max: limite("max_sucursales") },
    ...(plan?.modulos.includes("ecommerce") ? [{ label: "Productos", usados: productos, max: limite("max_productos") }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Suscripción</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">Tu plan, sus módulos y el pago mensual.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Plan {plan?.nombre ?? "—"}</CardTitle>
            <CardDescription>
              {sus ? `${formatCLP(Number(sus.precio_pactado))} al mes` : "Aún no tienes una suscripción"}
            </CardDescription>
          </div>
          <Badge variant={estadoBadge} className="text-right">{estadoTexto}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Módulos activos</p>
              {modulos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguno: renueva para reactivar tu barbería.</p>
              ) : (
                <ul className="space-y-1">
                  {modulos.map((m) => (
                    <li key={m} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      {MODULO_LABEL[m] ?? m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Uso del plan</p>
              {usoLimites.map((u) => (
                <div key={u.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{u.label}</span>
                    <span>{u.usados} {u.max === null ? "· sin límite" : `de ${u.max}`}</span>
                  </div>
                  {u.max !== null && u.max > 0 && (
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={u.usados >= u.max ? "h-full bg-amber-500" : "h-full bg-primary"}
                        style={{ width: `${Math.min(100, (u.usados / u.max) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <SuscripcionAcciones
            planes={planes.map((p) => ({ id_plan: p.id_plan, nombre: p.nombre, precio: p.precio_mensual, caracteristicas: caracteristicasPlan(p) }))}
            planActual={sus?.id_plan ?? null}
            pagando={sus?.estado === "activa" && renovacionAutomatica && !vencida}
          />
        </CardContent>
      </Card>

      {!!pagos?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Pagos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pagos.map((p) => (
              <div key={p.id_pago} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <span>{new Date(p.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" })}</span>
                <span className="flex items-center gap-3">
                  {formatCLP(Number(p.monto))}
                  <Badge variant={p.estado === "aprobado" ? "default" : p.estado === "rechazado" ? "destructive" : "secondary"}>{p.estado}</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
