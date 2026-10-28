import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error } = await supabase
            .from("usuario")
            .select("nombre, apellido, email, telefono, profile_image")
            .eq("id_usuario", user.id)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return NextResponse.json({ error: "Error fetching profile" }, { status: 500 });
        }

        // La UI usa "correo"
        return NextResponse.json({ ...profile, correo: profile.email });
    } catch (error) {
        console.error("Error in GET /api/profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Solo campos editables por el titular (los demás están protegidos por permisos de columna)
        const updateData: Record<string, string | null> = {};
        for (const campo of ["nombre", "apellido", "telefono"] as const) {
            if (body[campo] !== undefined) updateData[campo] = body[campo] || null;
        }

        const { data, error } = await supabase
            .from("usuario")
            .update(updateData)
            .eq("id_usuario", user.id)
            .select("nombre, apellido, email, telefono, profile_image")
            .single();

        if (error) {
            console.error("Error updating profile:", error);
            return NextResponse.json({ error: "Error updating profile" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error in PUT /api/profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
