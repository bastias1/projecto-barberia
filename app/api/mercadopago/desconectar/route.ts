import { NextRequest } from "next/server";
import { getStaffContext } from "@/lib/staff-context";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { volverABarberia } from "../volver";

/**
 * El admin desvincula la cuenta de Mercado Pago de su barbería (form POST; `barberia` = slug).
 * Borra el secreto y el vínculo: sin ella el checkout de la tienda queda bloqueado.
 * No revoca el acceso en Mercado Pago: el dueño puede quitarlo desde su cuenta.
 */
export async function POST(request: NextRequest) {
  const slug = (await request.formData().catch(() => null))?.get("barberia")?.toString() ?? null;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return volverABarberia(request, null, "error");

  const ctx = await getStaffContext(slug);
  if (!ctx?.isAdmin) return volverABarberia(request, slug, "error");

  const { error } = await createServiceRoleClient().rpc("mp_borrar", { p_barberia: ctx.barberia.id_barberia });
  if (error) {
    console.error("Mercado Pago - error al desvincular:", error);
    return volverABarberia(request, slug, "error");
  }
  return volverABarberia(request, slug, "desconectado");
}
