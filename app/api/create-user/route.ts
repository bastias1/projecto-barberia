import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated and is admin/owner
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("usuario")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!userData || (userData.rol !== "admin" && userData.rol !== "owner")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.json();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          nombre: formData.nombre,
          apellido: formData.apellido,
        }
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 400 });
    }

    // Create usuario record
    const { error: usuarioError } = await supabase
      .from("usuario")
      .insert({
        id: authData.user.id,
        nombre: formData.nombre,
        apellido: formData.apellido,
        correo: formData.email,
        telefono: formData.telefono || null,
        rol: formData.rol,
      });

    if (usuarioError) {
      return NextResponse.json({ error: usuarioError.message }, { status: 400 });
    }

    // Create barbero record (only if role is barbero, admin, or owner)
    if (['barbero', 'admin', 'owner'].includes(formData.rol)) {
      const { error: barberoError } = await supabase
        .from("barbero")
        .insert({
          id: authData.user.id,
          nombre: formData.nombre,
          apellido: formData.apellido,
          especialidad: formData.especialidad || null,
        });

      if (barberoError) {
        return NextResponse.json({ error: barberoError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
