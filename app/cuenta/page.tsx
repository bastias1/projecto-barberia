import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Mail, Scissors, Store } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
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

/** Inicio de la cuenta: invitaciones pendientes y barberías del usuario. */
export default async function CuentaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  const [{ data: usuario }, { membresias, esSuperadmin: superadmin }, { data: invitaciones }] = await Promise.all([
    supabase.from("usuario").select("nombre").eq("id_usuario", user.id).maybeSingle(),
    resolverAcceso(supabase, user.id),
    // RLS: solo las invitaciones dirigidas a su correo
    supabase
      .from("invitacion")
      .select("id_invitacion, token, rol, expira_at, barberia:barberia!invitacion_id_barberia_fkey (nombre, slug)")
      .eq("estado", "pendiente")
      .gte("expira_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

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

        {/* Invitaciones */}
        <Card className={invitaciones?.length ? "border border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Invitaciones</CardTitle>
            <CardDescription>Las barberías te invitan con este correo. Al aceptar, entras a su equipo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!invitaciones?.length ? (
              <p className="text-sm text-muted-foreground">
                No tienes invitaciones pendientes. Comparte tu correo <strong>{user.email}</strong> con la barbería donde trabajas.
              </p>
            ) : (
              invitaciones.map((inv) => {
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
              })
            )}
          </CardContent>
        </Card>

        {/* Barberías */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Mis barberías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trabajo.length === 0 && cliente.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no perteneces a ninguna barbería.</p>
            )}
            {trabajo.map((m) => (
              <div key={m.slug} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.nombre}</span>
                  <Badge variant="secondary">{ROL_LABEL[m.rol]}</Badge>
                </div>
                <Link href={`/${m.slug}/dashboard`}><Button size="sm">Ir al dashboard</Button></Link>
              </div>
            ))}
            {cliente.map((m) => (
              <div key={m.slug} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="font-medium">{m.nombre}</span>
                <Link href={`/${m.slug}`}><Button size="sm" variant="outline">Ver página</Button></Link>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Perfil: nombre y teléfono que ven las barberías donde trabaja o reserva */}
        <ProfileForm />

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
