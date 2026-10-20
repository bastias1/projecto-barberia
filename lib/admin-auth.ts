import { NextResponse } from "next/server";
import { getStaffContext, type StaffContext } from "./staff-context";

/**
 * Verifica que quien llama a una API de administración sea admin de la
 * barbería indicada en `?barberia=<slug>`. Las rutas usan service role
 * después de esta verificación.
 */
export async function requireAdmin(request: Request): Promise<{ ctx: StaffContext } | { response: NextResponse }> {
  const slug = new URL(request.url).searchParams.get("barberia");
  if (!slug) {
    return { response: NextResponse.json({ error: "Falta la barbería" }, { status: 400 }) };
  }
  const ctx = await getStaffContext(slug);
  if (!ctx) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!ctx.isAdmin) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx };
}
