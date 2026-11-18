import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Pruebas contra una base Supabase que NO es producción (.env.test.local):
 * TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, TEST_SUPABASE_SECRET_KEY.
 * Esa base necesita BDD.SQL, RLS.sql y BI.sql aplicados.
 */
for (const f of [".env.local", ".env.test.local"]) if (existsSync(f)) process.loadEnvFile(f);

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.TEST_SUPABASE_SECRET_KEY;
if (!URL || !ANON || !SERVICE) {
  throw new Error("Faltan TEST_SUPABASE_URL / TEST_SUPABASE_PUBLISHABLE_KEY / TEST_SUPABASE_SECRET_KEY en .env.test.local");
}
// las pruebas crean y borran datos: nunca contra la base de la app
if (URL === process.env.NEXT_PUBLIC_SUPABASE_URL || URL.includes("jrffkkktryskigbglpit")) {
  throw new Error("TEST_SUPABASE_URL apunta a producción: usa un proyecto o branch de pruebas");
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(URL, SERVICE, opciones);

const CLAVE = "Prueba-BI-2026!";

/** Usuario fijo de pruebas (se reutiliza: su consentimiento es inmutable y no se puede borrar). */
export async function usuarioPrueba(rol: string): Promise<{ id: string; db: SupabaseClient }> {
  const email = `bi-${rol}@pruebas.navaja.test`;
  const { data: existente } = await admin.from("usuario").select("id_usuario").eq("email", email).maybeSingle();
  let id = existente?.id_usuario as string | undefined;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: CLAVE, email_confirm: true,
      user_metadata: { acepta_terminos: true, version_politica: "pruebas", nombre: `Prueba ${rol}` },
    });
    if (error) throw error;
    id = data.user.id;
  }
  const db = createClient(URL!, ANON!, opciones);
  const { error } = await db.auth.signInWithPassword({ email, password: CLAVE });
  if (error) throw error;
  return { id, db };
}

/** Lanza si la respuesta de Supabase trae error; devuelve los datos. */
export function ok<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
