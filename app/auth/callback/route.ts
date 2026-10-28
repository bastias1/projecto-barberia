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
      // El perfil en public.usuario lo crea el trigger crear_perfil_usuario.
      // Si se registró desde una barbería, queda como cliente de ella.
      const barberia = slug ? await getBarberiaBySlug(supabase, slug) : null;
      if (barberia) {
        await supabase
          .from("usuario_barberia")
          .upsert(
            { id_usuario: data.user.id, id_barberia: barberia.id_barberia, rol: "cliente" },
            { onConflict: "id_usuario,id_barberia", ignoreDuplicates: true }
          );
      }

      // Redirect
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Sin código o canje fallido (p. ej. el link se abrió en otro navegador): el
  // correo ya quedó confirmado, así que se pide iniciar sesión y se conserva el destino
  const login = new URL("/login", requestUrl.origin);
  login.searchParams.set("confirmado", "1");
  if (next !== "/") login.searchParams.set("next", next);
  if (slug) login.searchParams.set("barberia", slug);
  return NextResponse.redirect(login);
}
