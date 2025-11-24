import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();

        const { data: reviews, error } = await supabase
            .from("resena")
            .select(`
        id,
        comentario,
        calificacion,
        guest_name,
        usuario:cliente (
          nombre,
          apellido
        ),
        barbero:barbero (
          nombre,
          apellido
        )
      `)
            .order("id", { ascending: false })
            .limit(10);

        if (error) {
            console.error("Error fetching reviews:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ reviews });
    } catch (error) {
        console.error("Error in GET /api/reviews:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { comentario, calificacion, barbero_id, guest_name } = body;

        if (!calificacion) {
            return NextResponse.json({ error: "Rating is required" }, { status: 400 });
        }

        if (!guest_name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Try to get authenticated user, but don't require it
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from("resena")
            .insert({
                comentario,
                calificacion,
                cliente: user?.id || null,
                barbero: barbero_id || null,
                guest_name: guest_name,
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating review:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ review: data });
    } catch (error) {
        console.error("Error in POST /api/reviews:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
