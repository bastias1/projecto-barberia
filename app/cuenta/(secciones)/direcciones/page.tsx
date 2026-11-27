import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { AddressManager } from "@/components/profile/address-manager";
import { requireCuenta } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

export default async function DireccionesPage() {
  await requireCuenta("/cuenta/direcciones");
  return (
    <>
      <EncabezadoSeccion titulo="Direcciones" descripcion="Para elegirlas rápido al pedir un despacho." />
      <AddressManager />
    </>
  );
}
