import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { cancelar } from "@/lib/suscripcion";

/** Detiene la renovación automática; la suscripción sigue vigente hasta su fecha de término. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const r = await cancelar(createServiceRoleClient(), auth.ctx.barberia.id_barberia);
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
