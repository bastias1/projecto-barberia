import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarberiaAcciones } from "@/components/admin/barberia-acciones";
import { BitacoraLista } from "@/components/admin/bitacora-lista";
import { createClient } from "@/utils/supabase/server";
import { ultimaSuscripcion } from "@/lib/suscripcion";
import { estadoSuscripcion, inicioMes, type SuscripcionResumen } from "@/lib/admin-datos";
import { getPlanes } from "@/lib/planes";
import { ROL_LABEL } from "@/lib/roles";
import { formatCLP, formatFecha } from "@/lib/datetime";
import { one } from "@/lib/utils";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminBarberiaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const { data: barberia } = await supabase
    .from("barberia")
    .select("id_barberia, nombre, slug, activa, telefono, email_contacto, created_at")
    .eq("id_barberia", id)
    .maybeSingle();
  if (!barberia) notFound();

  const [sus, planes, { data: sucursales }, { data: equipo }, { count: reservasMes }, { count: productos }, { data: pagos }, { data: bitacora }] = await Promise.all([
    ultimaSuscripcion(supabase, id),
    getPlanes(supabase, { incluirInactivos: true }),
    supabase.from("sucursal").select("id_sucursal, nombre, direccion, comuna, activa").eq("id_barberia", id).order("id_sucursal"),
    supabase
      .from("usuario_barberia")
      .select("rol, activo, usuario:usuario!usuario_barberia_id_usuario_fkey (id_usuario, nombre, apellido, email)")
      .eq("id_barberia", id)
      .in("rol", ["admin", "profesional"])
      .eq("activo", true),
    supabase.from("reserva").select("id_reserva", { count: "exact", head: true }).eq("id_barberia", id).neq("estado", "cancelada").gte("fecha_hora_inicio", inicioMes()),
    supabase.from("producto").select("id_producto", { count: "exact", head: true }).eq("id_barberia", id).eq("activo", true),
    supabase.from("pago").select("id_pago, monto, estado, created_at").eq("id_barberia", id).eq("concepto", "suscripcion").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("auditoria_admin")
      .select("id, accion, entidad, id_entidad, detalle, created_at, usuario:usuario!auditoria_admin_id_usuario_fkey (nombre, apellido)")
      .eq("entidad", "barberia")
      .eq("id_entidad", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const suscripcion = sus ? ({ ...sus, precio_pactado: Number(sus.precio_pactado) } as SuscripcionResumen & { fecha_inicio: string }) : null;
  const estado = estadoSuscripcion(suscripcion, barberia.activa);
  const plan = planes.find((p) => p.id_plan === suscripcion?.id_plan);

  return (
    <div className="space-y-6">
      <Link href="/admin/barberias">
        <Button variant="ghost" className="gap-2 -ml-3"><ArrowLeft className="h-4 w-4" />Barberías</Button>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{barberia.nombre}</h1>
            <Badge variant={estado.tono}>{estado.label}</Badge>
          </div>
          <p className="text-muted-foreground font-mono">/{barberia.slug}</p>
          <p className="text-sm text-muted-foreground">
            Registrada el {formatFecha(barberia.created_at.slice(0, 10), "d 'de' MMMM yyyy")}
            {barberia.email_contacto && ` · ${barberia.email_contacto}`}
            {barberia.telefono && ` · ${barberia.telefono}`}
          </p>
        </div>
        {barberia.activa && (
          <div className="flex gap-2">
            <a href={`/${barberia.slug}`} target="_blank"><Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" />Página</Button></a>
            <Link href={`/${barberia.slug}/dashboard`}><Button className="gap-2"><LayoutDashboard className="h-4 w-4" />Entrar al dashboard</Button></Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>
              {suscripcion
                ? `Plan ${plan?.nombre ?? "—"} · ${formatCLP(suscripcion.precio_pactado)}/mes · desde el ${formatFecha(suscripcion.fecha_inicio, "d MMM yyyy")}` +
                  (suscripcion.fecha_termino ? ` · hasta el ${formatFecha(suscripcion.fecha_termino, "d MMM yyyy")}` : " · sin vencimiento")
                : "Sin suscripción registrada"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarberiaAcciones
              idBarberia={barberia.id_barberia}
              nombre={barberia.nombre}
              activa={barberia.activa}
              idPlan={suscripcion?.id_plan ?? null}
              fechaTermino={suscripcion?.fecha_termino ?? null}
              cobroAutomatico={!!suscripcion?.id_suscripcion_externa}
              planes={planes.map((p) => ({ id_plan: p.id_plan, nombre: p.nombre, precio: p.precio_mensual, activo: p.activo }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Uso</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Sucursales activas", (sucursales ?? []).filter((s) => s.activa).length, plan?.limites.max_sucursales],
                ["Barberos", (equipo ?? []).filter((e) => e.rol === "profesional").length, plan?.limites.max_profesionales],
                ["Productos activos", productos ?? 0, plan?.limites.max_productos],
              ].map(([label, usados, max]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{String(usados)} {max === null || max === undefined ? "· sin límite" : `de ${max}`}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reservas este mes</span>
                <span>{reservasMes ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Equipo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(equipo ?? []).length === 0 && <p className="text-muted-foreground">Sin miembros.</p>}
              {(equipo ?? []).map((e) => {
                const u = one<{ id_usuario: string; nombre: string; apellido: string | null; email: string }>(e.usuario);
                return (
                  <div key={u?.id_usuario} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/usuarios?q=${encodeURIComponent(u?.email ?? "")}`} className="truncate hover:underline">
                      {[u?.nombre, u?.apellido].filter(Boolean).join(" ")}
                      <span className="block text-xs text-muted-foreground truncate">{u?.email}</span>
                    </Link>
                    <Badge variant="secondary">{ROL_LABEL[e.rol as "admin" | "profesional"]}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Sucursales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(sucursales ?? []).map((s) => (
              <div key={s.id_sucursal} className="flex justify-between gap-2">
                <span>{s.nombre}<span className="block text-xs text-muted-foreground">{s.direccion}, {s.comuna}</span></span>
                {!s.activa && <Badge variant="outline">Inactiva</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pagos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!pagos?.length && <p className="text-muted-foreground">Sin pagos de suscripción.</p>}
            {(pagos ?? []).map((p) => (
              <div key={p.id_pago} className="flex justify-between">
                <span className="text-muted-foreground">{formatFecha(p.created_at.slice(0, 10), "d MMM yyyy")}</span>
                <span className="flex items-center gap-2">
                  {formatCLP(Number(p.monto))}
                  <Badge variant={p.estado === "aprobado" ? "default" : p.estado === "rechazado" ? "destructive" : "secondary"}>{p.estado}</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Actividad del panel</CardTitle></CardHeader>
          <CardContent>
            <BitacoraLista filas={bitacora ?? []} compacta />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
