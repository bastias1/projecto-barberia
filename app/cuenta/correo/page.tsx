import { ConfirmarCorreo } from "./confirmar-correo";

/** Destino del link del correo "Confirma tu nuevo correo". Pública: puede abrirse sin sesión. */
export default async function CorreoPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  return <ConfirmarCorreo tokenHash={(await searchParams).token_hash} />;
}
