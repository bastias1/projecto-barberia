import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getBarberiaBySlug } from "@/lib/barberia";

interface ResenaPublicaRow {
    id_resena: number;
    comentario: string | null;
    calificacion: number;
    created_at: string;
    autor: string;
    profesional: string | null;
    servicio: string | null;
    producto: string | null;
}

/**
 * Reseñas públicas de la barbería. Las reseñas nuevas solo se crean desde el
 * link firmado que recibe el cliente por correo (ver /api/reviews/link).
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const searchParams = new URL(request.url).searchParams;
        const limit = Number(searchParams.get("limit")) || 10;
        const barberia = await getBarberiaBySlug(supabase, searchParams.get("barberia") ?? "");

        if (!barberia) {
            return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });
        }

        const { data, error } = await supabase.rpc("resenas_publicas", {
            p_barberia: barberia.id_barberia,
            p_limite: limit,
        });

        if (error) {
            console.error("Error fetching reviews:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const reviews = ((data || []) as ResenaPublicaRow[]).map((r) => ({
            id: r.id_resena,
            comentario: r.comentario,
            calificacion: r.calificacion,
            created_at: r.created_at,
            autor: r.autor,
            profesional: r.profesional,
            servicio: r.servicio,
            producto: r.producto,
        }));

        return NextResponse.json({ reviews });
    } catch (error) {
        console.error("Error in GET /api/reviews:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
