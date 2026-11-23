"use server"

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VERSION_POLITICA } from "@/lib/plataforma";
import { safeNext } from "@/lib/utils";
import { notificarBienvenida } from "@/lib/notifications";

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

  // Contraseña opcional: quien entró con Google puede además entrar con correo y clave
  const clave = formData.get("password")?.toString() ?? "";
  if (clave) {
    // No se vuelve a esta página si falla: el consentimiento ya quedó y repetirlo chocaría; puede crearla en /cuenta/clave
    const { error: errorClave } = await supabase.auth.updateUser({ password: clave });
    if (errorClave) console.error("[terminos] no se pudo guardar la contraseña:", errorClave);
  }

  await notificarBienvenida(user);
  redirect(next);
}
