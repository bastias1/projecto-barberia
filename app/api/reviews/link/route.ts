import { NextResponse } from "next/server";
import { purposeResena, verifyLink } from "@/lib/signed-links";
import { cargarResenaPedido, cargarResenaReserva } from "@/lib/review-link";
import { createServiceRoleClient } from "@/utils/supabase/service-role";

const MAX_COMENTARIO = 1000;

/**
 * Crea una reseña desde el link firmado del correo. El token identifica la
 * reserva o el pedido; el autor se toma de ese registro, nunca del cliente.
 * Los triggers de la base validan además que la reserva esté completada o
 * que el producto haya sido comprado y entregado.
 */
export async function POST(request: Request) {
    try {
        const { tipo, id, token, calificacion, comentario, id_producto } = await request.json();
        const idNum = Number(id);

        if ((tipo !== "reserva" && tipo !== "pedido") || !Number.isInteger(idNum)) {
            return NextResponse.json({ error: "Link inválido" }, { status: 400 });
        }
        if (!verifyLink(purposeResena(tipo), idNum, token)) {
            return NextResponse.json({ error: "Link inválido o vencido" }, { status: 403 });
        }

        const nota = Number(calificacion);
        if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
            return NextResponse.json({ error: "La calificación debe ser de 1 a 5 estrellas" }, { status: 400 });
        }
        const texto = typeof comentario === "string" ? comentario.trim().slice(0, MAX_COMENTARIO) : "";

        const supabase = createServiceRoleClient();

        if (tipo === "reserva") {
            const reserva = await cargarResenaReserva(idNum);
            if (!reserva) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
            if (!reserva.completada) return NextResponse.json({ error: "La cita aún no se ha completado" }, { status: 400 });
            if (reserva.yaResenada) return NextResponse.json({ error: "Ya dejaste una reseña para esta cita" }, { status: 409 });

            const { error } = await supabase.from("resena").insert({
                id_barberia: reserva.idBarberia,
                id_reserva: reserva.id,
                id_cliente: reserva.idCliente,
                id_guest: reserva.idGuest,
                calificacion: nota,
                comentario: texto || null,
            });
            if (error) {
                console.error("Error creating review:", error);
                return NextResponse.json({ error: "No se pudo guardar la reseña" }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        const pedido = await cargarResenaPedido(idNum);
        if (!pedido || !pedido.idCliente) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        if (!pedido.entregado) return NextResponse.json({ error: "El pedido aún no ha sido entregado" }, { status: 400 });

        const producto = pedido.productos.find((p) => p.id_producto === Number(id_producto));
        if (!producto) return NextResponse.json({ error: "El producto no pertenece a este pedido" }, { status: 400 });
        if (producto.yaResenado) return NextResponse.json({ error: "Ya calificaste este producto" }, { status: 409 });

        const { error } = await supabase.from("resena").insert({
            id_barberia: pedido.idBarberia,
            id_cliente: pedido.idCliente,
            id_producto: producto.id_producto,
            calificacion: nota,
            comentario: texto || null,
        });
        if (error) {
            console.error("Error creating review:", error);
            return NextResponse.json({ error: "No se pudo guardar la reseña" }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in POST /api/reviews/link:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
