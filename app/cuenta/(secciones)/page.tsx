import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoSeccion, SECCIONES } from "@/components/cuenta/secciones";
import { Invitaciones } from "@/components/cuenta/invitaciones";
import { ListaReservas } from "@/components/cuenta/historial-reservas";
import { HistorialPedidos } from "@/components/cuenta/historial-pedidos";
import { getCompras, getInvitaciones, getReservas, requireCuenta } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

const ATAJOS = SECCIONES.slice(1);

/** Resumen de la cuenta: lo que requiere atención (invitaciones, próxima cita, compra en curso) y atajos. */
export default async function CuentaPage() {
  const { supabase, user } = await requireCuenta("/cuenta");
  const [{ data: usuario }, invitaciones, reservas, compras] = await Promise.all([
    supabase.from("usuario").select("nombre").eq("id_usuario", user.id).maybeSingle(),
    getInvitaciones(supabase, user.email),
    getReservas(supabase),
    getCompras(supabase, user.id, { limite: 1, enCurso: true }),
  ]);
  const proxima = reservas.proximas[0];
  const vacio = !invitaciones.length && !proxima && !compras.length;

  return (
    <>
      <EncabezadoSeccion titulo={`Hola, ${usuario?.nombre ?? user.email?.split("@")[0]}`} descripcion={user.email} />

      <Invitaciones invitaciones={invitaciones} />

      {proxima && (
        <section aria-labelledby="proxima" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="proxima" className="font-semibold">Tu próxima cita</h2>
            <Link href="/cuenta/reservas" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Ver todas</Link>
          </div>
          <ListaReservas reservas={[proxima]} />
        </section>
      )}

      {!!compras.length && (
        <section aria-labelledby="compra" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="compra" className="font-semibold">Compra en curso</h2>
            <Link href="/cuenta/compras" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Ver todas</Link>
          </div>
          <HistorialPedidos orders={compras} />
        </section>
      )}

      {vacio && (
        <Card>
          <CardHeader>
            <CardTitle>Te damos la bienvenida</CardTitle>
            <CardDescription>Aún no tienes citas ni compras. Busca una barbería para reservar tu primera hora.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/barberias">Buscar barberías</Link></Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="atajos" className="space-y-3">
        <h2 id="atajos" className="font-semibold">Tu cuenta</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ATAJOS.map(({ href, label, texto, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="tarjeta flex h-full items-center gap-3 rounded-lg p-4 transition-colors hover:bg-accent/60">
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
