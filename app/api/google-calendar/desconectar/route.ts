import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { revocarToken } from "@/lib/google-calendar-oauth";
import { volverAConfiguracion } from "../volver";

/**
 * HU-24: el usuario con sesión desvincula su Google (form POST; `barberia` = slug para volver).
 * Revoca el token, borra el secreto y el vínculo; la cola cae en cascada. Los eventos ya creados quedan en su calendario.
 */
export async function POST(request: NextRequest) {
  const slug = (await request.formData().catch(() => null))?.get("barberia")?.toString() ?? null;
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return volverAConfiguracion(request, slug, "error");

  const admin = createServiceRoleClient();
  const { data: token } = await admin.rpc("gcal_token", { p_usuario: user.id });
  if (token) {
    // Si Google no responde se desvincula igual: aquí el token deja de usarse y el usuario puede quitar el acceso en su cuenta
    await revocarToken(token as string).catch((e) => console.error("Google Calendar - error al revocar:", e));
  }
  const { error } = await admin.rpc("gcal_borrar", { p_usuario: user.id });
  if (error) {
    console.error("Google Calendar - error al desvincular:", error);
    return volverAConfiguracion(request, slug, "error");
  }
  return volverAConfiguracion(request, slug, "desconectado");
}
