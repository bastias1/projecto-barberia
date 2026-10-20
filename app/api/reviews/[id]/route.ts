import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff-context";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await getStaffContext(new URL(request.url).searchParams.get("barberia") ?? "");

        if (!ctx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // RLS: solo el administrador de la barbería (o el autor) puede eliminar
        if (!ctx.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("resena")
            .delete()
            .eq("id_resena", id)
            .eq("id_barberia", ctx.barberia.id_barberia)
            .select("id_resena");

        if (error) {
            console.error("Error deleting review:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
        }

        return NextResponse.json({ message: "Review deleted successfully" });
    } catch (error) {
        console.error("Error in DELETE /api/reviews/[id]:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
