import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
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

    // Fetch all users with admin, owner, or barbero roles
    const { data, error } = await supabase
      .from("usuario")
      .select(`
        id,
        nombre,
        apellido,
        correo,
        rol,
        barbero:barbero(especialidad)
      `)
      .in('rol', ['admin', 'owner', 'barbero'])
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data
    const transformedData = (data || []).map((user: any) => ({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      especialidad: Array.isArray(user.barbero) && user.barbero.length > 0 
        ? user.barbero[0].especialidad 
        : null,
      usuario: {
        correo: user.correo,
        rol: user.rol
      }
    }));

    return NextResponse.json({ users: transformedData });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
