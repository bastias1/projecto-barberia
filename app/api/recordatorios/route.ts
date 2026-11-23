import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { notificarRecordatorios } from "@/lib/notifications";

// Lo llama el job pg_cron 'recordatorios-reservas' cada hora (Authorization: Bearer CRON_SECRET)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ enviados: await notificarRecordatorios() });
  } catch (e) {
    console.error("[recordatorios]", e);
    return NextResponse.json({ error: "Error al enviar recordatorios" }, { status: 500 });
  }
}
