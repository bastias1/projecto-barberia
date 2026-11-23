import crypto from "crypto";
import { NextResponse } from "next/server";
import { notificarRecordatorios } from "@/lib/notifications";

// Lo llama el job pg_cron 'recordatorios-reservas' cada hora (Authorization: Bearer CRON_SECRET)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(header: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !header) return false;
  // hash de ambos lados: timingSafeEqual exige el mismo largo
  const h = (v: string) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(h(header), h(`Bearer ${secreto}`));
}

export async function POST(request: Request) {
  if (!autorizado(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json({ enviados: await notificarRecordatorios() });
  } catch (e) {
    console.error("[recordatorios]", e);
    return NextResponse.json({ error: "Error al enviar recordatorios" }, { status: 500 });
  }
}
