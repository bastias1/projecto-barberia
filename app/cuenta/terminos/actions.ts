"use server"

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VERSION_POLITICA } from "@/lib/plataforma";
import { safeNext } from "@/lib/utils";

/** Registra términos + privacidad de quien entró con Google (la política RLS solo deja insertar los propios). */
export async function aceptarTerminos(formData: FormData) {
  const next = safeNext(formData.get("next")?.toString()) ?? "/cuenta";
  if (formData.get("acepta") !== "on") redirect(`/cuenta/terminos?${new URLSearchParams({ next, error: "1" })}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next })}`);

  const { error } = await supabase.from("consentimiento").insert([
    { id_usuario: user.id, tipo: "terminos", version_politica: VERSION_POLITICA, aceptado: true },
    { id_usuario: user.id, tipo: "privacidad", version_politica: VERSION_POLITICA, aceptado: true },
  ]);
  if (error) {
    console.error("[terminos] no se pudo registrar el consentimiento:", error);
    redirect(`/cuenta/terminos?${new URLSearchParams({ next, error: "1" })}`);
  }
  redirect(next);
}
