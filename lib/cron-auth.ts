import crypto from "crypto";

/** ¿La llamada trae `Authorization: Bearer CRON_SECRET`? Para las rutas que invocan los jobs pg_cron. */
export function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secreto || !header) return false;
  // hash de ambos lados: timingSafeEqual exige el mismo largo
  const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(sha256(header), sha256(`Bearer ${secreto}`));
}
