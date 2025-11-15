import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // User is now confirmed and has a session
      // Check if usuario and barbero records exist, create if not
      const userId = data.user.id;
      const email = data.user.email || "";
      const nombre = data.user.user_metadata?.nombre || email.split("@")[0];
      const apellido = data.user.user_metadata?.apellido || "";
      const especialidad = data.user.user_metadata?.especialidad || null;

      // Check/create usuario
      const { data: usuarioData } = await supabase
        .from("usuario")
        .select("*")
        .eq("id", userId)
        .single();

      if (!usuarioData) {
        await supabase.from("usuario").insert({
          id: userId,
          nombre: nombre,
          apellido: apellido,
          correo: email,
          telefono: "",
          rol: "barbero",
        });
      }

      // Check/create barbero
      const { data: barberoData } = await supabase
        .from("barbero")
        .select("*")
        .eq("id", userId)
        .single();

      if (!barberoData) {
        await supabase.from("barbero").insert({
          id: userId,
          nombre: nombre,
          apellido: apellido,
          especialidad: especialidad,
        });
      }

      // Redirect to dashboard
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
