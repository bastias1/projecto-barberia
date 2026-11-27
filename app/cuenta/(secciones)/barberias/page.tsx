import Link from "next/link";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { Invitaciones } from "@/components/cuenta/invitaciones";
import { EliminarBarberia } from "@/components/cuenta/eliminar-barberia";
import { getInvitaciones, requireCuenta } from "@/lib/cuenta";
import { resolverAcceso } from "@/lib/acceso";
import { ROL_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Barberías de la cuenta: invitaciones, membresías, las propias (eliminar) y registrar una nueva. */
export default async function BarberiasCuentaPage() {
  const { supabase, user } = await requireCuenta("/cuenta/barberias");
  const [{ membresias }, invitaciones, { data: propias }] = await Promise.all([
    resolverAcceso(supabase, user.id),
    getInvitaciones(supabase, user.email),
    supabase.from("barberia").select("id_barberia, nombre, slug, activa").eq("id_propietario", user.id).is("eliminada_at", null),
  ]);
  const trabajo = membresias.filter((m) => m.rol !== "cliente");
  const cliente = membresias.filter((m) => m.rol === "cliente");
  // Una suspendida no está entre las membresías, pero su propietario igual puede eliminarla
  const suspendidas = (propias ?? []).filter((b) => !b.activa);
  const fila = "tarjeta flex flex-wrap items-center justify-between gap-3 rounded-lg p-4";

  return (
    <>
      <EncabezadoSeccion titulo="Barberías" descripcion="Donde trabajas y donde eres cliente." />
      <Invitaciones invitaciones={invitaciones} />

      {(trabajo.length > 0 || suspendidas.length > 0) && (
        <section aria-labelledby="trabajo" className="space-y-3">
          <h2 id="trabajo" className="font-semibold">Donde trabajas</h2>
          <ul className="space-y-2">
            {trabajo.map((m) => (
              <li key={m.slug} className={fila}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.nombre}</span>
                  <Badge variant="secondary">{ROL_LABEL[m.rol]}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {propias?.filter((b) => b.slug === m.slug).map((b) => <EliminarBarberia key={b.id_barberia} idBarberia={b.id_barberia} nombre={b.nombre} />)}
                  <Button asChild size="sm"><Link href={`/${m.slug}/dashboard`}>Ir al dashboard</Link></Button>
                </div>
              </li>
            ))}
            {suspendidas.map((b) => (
              <li key={b.id_barberia} className={fila}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.nombre}</span>
                  <Badge variant="outline">Suspendida</Badge>
                </div>
                <EliminarBarberia idBarberia={b.id_barberia} nombre={b.nombre} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cliente.length > 0 && (
        <section aria-labelledby="cliente" className="space-y-3">
          <h2 id="cliente" className="font-semibold">Donde eres cliente</h2>
          <ul className="space-y-2">
            {cliente.map((m) => (
              <li key={m.slug} className={fila}>
                <span className="font-medium">{m.nombre}</span>
                <Button asChild size="sm" variant="outline"><Link href={`/${m.slug}`}>Ver página</Link></Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!membresias.length && !suspendidas.length && (
        <p className="text-muted-foreground">Aún no perteneces a ninguna barbería. Te sumas al reservar o comprar en una, o con una invitación de su equipo.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scissors className="h-5 w-5" aria-hidden="true" />¿Tienes tu propia barbería?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Regístrala en minutos: agenda en línea, tienda y panel para tu equipo.</p>
          <Button asChild><Link href="/registro">Registrar mi barbería</Link></Button>
        </CardContent>
      </Card>
    </>
  );
}
