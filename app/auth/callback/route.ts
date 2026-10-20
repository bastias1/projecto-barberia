import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getBarberiaBySlug } from "@/lib/barberia";
import { safeNext } from "@/lib/utils";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Solo rutas internas (evita redirecciones abiertas)
  const next = safeNext(requestUrl.searchParams.get("next")) ?? "/";
  // Barbería desde la que se registró (si se registró como cliente de una)
  const slug = requestUrl.searchParams.get("barberia");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // User is now confirmed and has a session
      const userId = data.user.id;
      const email = data.user.email || "";
      const userMetadata = data.user.user_metadata || {};
      const nombre = userMetadata.nombre || email.split("@")[0];
      const apellido = userMetadata.apellido || "";
      // Check/create usuario (signups confirmed by email). Las cuentas de
      // barbero las crea un admin, así que aquí solo se registran clientes.
      const { data: usuarioData } = await supabase
        .from("usuario")
        .select("id_usuario")
        .eq("id_usuario", userId)
        .maybeSingle();

      if (!usuarioData) {
        await supabase.from("usuario").insert({
          id_usuario: userId,
          nombre: nombre,
          apellido: apellido || null,
          email: email.toLowerCase(),
        });

        const barberia = slug ? await getBarberiaBySlug(supabase, slug) : null;
        if (barberia) {
          await supabase.from("usuario_barberia").insert({
            id_usuario: userId,
            id_barberia: barberia.id_barberia,
            rol: "cliente",
          });
        }
      }

      // Redirect
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
