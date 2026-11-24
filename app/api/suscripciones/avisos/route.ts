import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { avisarVencimientos } from "@/lib/suscripcion";
import { createServiceRoleClient } from "@/utils/supabase/service-role";

// Lo llama el job pg_cron 'avisos-suscripcion' una vez al día (Authorization: Bearer CRON_SECRET)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ enviados: await avisarVencimientos(createServiceRoleClient()) });
  } catch (e) {
    console.error("[suscripciones] avisos:", e);
    return NextResponse.json({ error: "Error al enviar avisos" }, { status: 500 });
  }
}
