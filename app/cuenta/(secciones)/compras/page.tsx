import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { HistorialPedidos } from "@/components/cuenta/historial-pedidos";
import { getCompras, requireCuenta } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

/** Compras de la cuenta en las tiendas de las barberías (las 100 más recientes). */
export default async function ComprasPage() {
  const { supabase, user } = await requireCuenta("/cuenta/compras");
  const compras = await getCompras(supabase, user.id);

  return (
    <>
      <EncabezadoSeccion titulo="Compras" descripcion="Tus pedidos en las tiendas de las barberías." />
      {compras.length ? <HistorialPedidos orders={compras} /> : (
        <div className="tarjeta space-y-3 rounded-lg p-6 text-center">
          <p className="text-muted-foreground">Aún no has comprado nada.</p>
          <Button asChild><Link href="/barberias">Explorar barberías</Link></Button>
        </div>
      )}
    </>
  );
}
