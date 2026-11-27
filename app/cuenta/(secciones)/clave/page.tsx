import { redirect } from "next/navigation";
import { getSesionCuenta } from "@/lib/cuenta";
import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { ClaveForm } from "./clave-form";

/** Seguridad: nueva contraseña desde la cuenta o desde el link de recuperación del correo (este último sin sesión). */
export default async function CambiarClavePage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  const { supabase, user } = await getSesionCuenta();
  // Sin sesión ni link de recuperación no se puede cambiar
  if (!user && !token_hash) redirect("/login?next=/cuenta/clave");
  // Con el link de recuperación no se conoce la actual; una cuenta de Google puede no tener
  const { data: tengoClave } = user && !token_hash ? await supabase.rpc("tengo_clave") : { data: false };
  const form = <ClaveForm tokenHash={token_hash} conSesion={!!user} pedirActual={tengoClave === true} />;
  if (!user) return form;
  return (
    <>
      <EncabezadoSeccion titulo="Seguridad" descripcion="Tu contraseña y tu sesión." />
      {form}
      <div className="tarjeta flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Cierra la sesión en este navegador.</p>
        <CerrarSesion />
      </div>
    </>
  );
}
