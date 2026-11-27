import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ClaveForm } from "./clave-form";

/** Nueva contraseña: desde "Mi cuenta" o desde el link de recuperación del correo. */
export default async function CambiarClavePage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Sin sesión ni link de recuperación no se puede cambiar
  if (!user && !token_hash) redirect("/login?next=/cuenta/clave");
  // Con el link de recuperación no se conoce la actual; una cuenta de Google puede no tener
  const { data: tengoClave } = user && !token_hash ? await supabase.rpc("tengo_clave") : { data: false };
  return <ClaveForm tokenHash={token_hash} conSesion={!!user} pedirActual={tengoClave === true} />;
}
