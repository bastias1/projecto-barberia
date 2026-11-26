import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Mail, Scissors, Store } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
import { AddressManager } from "@/components/profile/address-manager";
import { HistorialReservas, type ReservaCuenta } from "@/components/cuenta/historial-reservas";
import { HistorialPedidos, type PedidoCuenta } from "@/components/cuenta/historial-pedidos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeaderPlataforma } from "@/components/plataforma/header";
import { ResponderInvitacion } from "@/components/cuenta/responder-invitacion";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { createClient } from "@/utils/supabase/server";
import { resolverAcceso } from "@/lib/acceso";
import { ROL_LABEL } from "@/lib/roles";
import { one } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Única página de la cuenta: invitaciones, barberías, historial, perfil y direcciones. */
export default async function CuentaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  const [{ data: usuario }, { membresias, esSuperadmin: superadmin }, { data: invitaciones }, { data: reservas, error: errorReservas }, { data: pedidos, error: errorPedidos }] = await Promise.all([
    supabase.from("usuario").select("nombre").eq("id_usuario", user.id).maybeSingle(),
    resolverAcceso(supabase, user.id),
    // El filtro por correo es necesario: RLS también deja ver al admin (y al superadmin) las que envió
    supabase
      .from("invitacion")
      .select("id_invitacion, token, rol, expira_at, barberia:barberia!invitacion_id_barberia_fkey (nombre, slug)")
      .eq("correo", (user.email ?? "").toLowerCase())
      .eq("estado", "pendiente")
      .gte("expira_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.rpc("mis_reservas"),
    // El filtro por cliente es necesario: al personal RLS también le muestra los pedidos de otros
    supabase
      .from("pedido")
      .select(`
        id:id_pedido, created_at, monto_total, estado, estado_pago, tipo_entrega, direccion_envio,
        barberia:barberia!pedido_id_barberia_fkey (nombre),
        detalle_pedido!detalle_pedido_pedido_fkey (
          id:id_detalle, cantidad, subtotal,
          producto:producto!detalle_pedido_producto_fkey (nombre, precio, imagen_url)
        )
      `)
      .eq("id_cliente", user.id)
      .order("id_pedido", { ascending: false })
      .limit(100),
  ]);
  if (errorReservas) console.error("[cuenta] reservas:", errorReservas);
  if (errorPedidos) console.error("[cuenta] pedidos:", errorPedidos);
  const misPedidos = (pedidos ?? []).map((o) => ({
    ...o,
    barberia: one<{ nombre: string }>(o.barberia)?.nombre ?? null,
    detalle_pedido: (o.detalle_pedido ?? []).map((d) => ({ ...d, producto: one(d.producto) })),
  })) as unknown as PedidoCuenta[];

  const trabajo = membresias.filter((m) => m.rol !== "cliente");
  const cliente = membresias.filter((m) => m.rol === "cliente");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <HeaderPlataforma simple />
      <div className="p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="display text-4xl break-words">Hola, {usuario?.nombre ?? user.email?.split("@")[0]}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        {superadmin && (
          <Link href="/admin" className="block">
            <Card className="border border-primary hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="font-semibold">Panel de la plataforma</span>
                <Button size="sm">Abrir</Button>
              </CardContent>
            </Card>
          </Link>
        )}

        {!!invitaciones?.length && (
          <Card className="border border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Invitaciones</CardTitle>
              <CardDescription>Al aceptar, entras al equipo de la barbería.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitaciones.map((inv) => {
                const b = one<{ nombre: string; slug: string }>(inv.barberia);
                return (
                  <div key={inv.id_invitacion} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-semibold">{b?.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        Como {ROL_LABEL[inv.rol as "admin" | "profesional"].toLowerCase()} · vence el{" "}
                        {new Date(inv.expira_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" })}
                      </p>
                    </div>
                    <ResponderInvitacion token={inv.token} barberia={b?.nombre ?? "la barbería"} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {membresias.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Mis barberías</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trabajo.map((m) => (
                <div key={m.slug} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.nombre}</span>
                    <Badge variant="secondary">{ROL_LABEL[m.rol]}</Badge>
                  </div>
                  <Button asChild size="sm"><Link href={`/${m.slug}/dashboard`}>Ir al dashboard</Link></Button>
                </div>
              ))}
              {cliente.map((m) => (
                <div key={m.slug} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="font-medium">{m.nombre}</span>
                  <Button asChild size="sm" variant="outline"><Link href={`/${m.slug}`}>Ver página</Link></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!!reservas?.length && <HistorialReservas reservas={reservas as ReservaCuenta[]} />}
        {misPedidos.length > 0 && <HistorialPedidos orders={misPedidos} />}

        {/* Perfil: nombre y teléfono que ven las barberías donde trabaja o reserva */}
        <ProfileForm />
        <AddressManager />

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/registro">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <Scissors className="h-5 w-5" />
                <div>
                  <p className="font-medium">¿Tienes tu propia barbería?</p>
                  <p className="text-xs text-muted-foreground">Regístrala y prueba gratis</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/cuenta/clave">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <KeyRound className="h-5 w-5" />
                <div>
                  <p className="font-medium">Cambiar contraseña</p>
                  <p className="text-xs text-muted-foreground">Actualiza tu acceso</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="text-center">
          <CerrarSesion />
        </div>
      </div>
      </div>
    </div>
  );
}
