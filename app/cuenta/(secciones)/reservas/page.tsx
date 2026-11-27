import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { ListaReservas } from "@/components/cuenta/historial-reservas";
import { getReservas, requireCuenta } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

/** HU-22: reservas de la cuenta (y las de invitado con su correo), próximas y anteriores. */
export default async function ReservasCuentaPage() {
  const { supabase } = await requireCuenta("/cuenta/reservas");
  const { proximas, anteriores } = await getReservas(supabase);

  return (
    <>
      <EncabezadoSeccion titulo="Reservas" descripcion="Hechas con tu cuenta o con tu correo, en todas las barberías." />
      {!proximas.length && !anteriores.length ? (
        <div className="tarjeta space-y-3 rounded-lg p-6 text-center">
          <p className="text-muted-foreground">Aún no tienes reservas.</p>
          <Button asChild><Link href="/barberias">Buscar barberías</Link></Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="proximas" className="space-y-3">
            <h2 id="proximas" className="font-semibold">Próximas</h2>
            {proximas.length ? <ListaReservas reservas={proximas} /> : <p className="text-sm text-muted-foreground">No tienes citas por delante.</p>}
          </section>
          {!!anteriores.length && (
            <section aria-labelledby="anteriores" className="space-y-3">
              <h2 id="anteriores" className="font-semibold">Anteriores</h2>
              <ListaReservas reservas={anteriores} />
            </section>
          )}
        </>
      )}
    </>
  );
}
