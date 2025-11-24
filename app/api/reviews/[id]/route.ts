import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin, owner, or the barber associated with the review (optional logic, for now just check role)
        // For simplicity, we'll allow any authenticated barber/admin to delete for now, or check role.
        // Let's check if they are at least a barber.
        const { data: userData } = await supabase
            .from("usuario")
            .select("rol")
            .eq("id", user.id)
            .single();

        if (!userData || (userData.rol !== "admin" && userData.rol !== "owner" && userData.rol !== "barbero")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { error } = await supabase
            .from("resena")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting review:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Review deleted successfully" });
    } catch (error) {
        console.error("Error in DELETE /api/reviews/[id]:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
