'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { notificarCambioReserva, notificarResenaPedido, notificarResenaReserva } from "@/lib/notifications";

const ESTADOS_RESERVA = ["pendiente", "confirmada", "completada", "cancelada", "no_asistio"];
const ESTADOS_PEDIDO = ["pendiente", "confirmado", "preparando", "listo_retiro", "enviado", "entregado", "cancelado"];

export async function updateBookingStatus(id: number, status: string) {
    if (!ESTADOS_RESERVA.includes(status)) {
        throw new Error("Estado de reserva inválido");
    }

    const supabase = await createClient();

    // RLS: solo el personal de la barbería puede cambiar el estado
    let consulta = supabase.from("reserva").update({ estado: status }).eq("id_reserva", id);
    // Ya cancelada: no se repite ni el cambio ni el correo al cliente
    if (status === "cancelada") consulta = consulta.neq("estado", "cancelada");
    const { data, error } = await consulta.select("id_reserva").maybeSingle();

    if (!error && !data && status === "cancelada") return;

    if (error || !data) {
        console.error("Error updating booking status:", error);
        throw new Error("Failed to update booking status");
    }

    // Al completar la cita se invita al cliente a dejar su reseña
    if (status === "completada") {
        await notificarResenaReserva(id);
    }

    // Si el personal cancela, el cliente se entera (cancelar por el link ya lo avisa en cambiarReservaCliente)
    if (status === "cancelada") {
        await notificarCambioReserva(id, "cancelada").catch((e) => console.error("[notificaciones] cancelación:", e));
    }

    revalidatePath("/[slug]/dashboard", "layout");
}

export async function updateOrderStatus(id: number, status: string) {
    if (!ESTADOS_PEDIDO.includes(status)) {
        throw new Error("Estado de pedido inválido");
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Unauthorized");
    }

    // The RLS policy will verify if user is staff of the barbershop
    const { data, error } = await supabase
        .from("pedido")
        .update({ estado: status })
        .eq("id_pedido", id)
        .select("id_pedido, estado")
        .maybeSingle();

    if (error || !data) {
        console.error("Error updating order status:", error);
        if (!data && !error) {
            throw new Error("No tienes permisos para actualizar pedidos");
        }
        // Mensajes de los triggers (p. ej. un pedido cancelado no se reactiva)
        throw new Error(error?.code === '23514' ? error.message : "Failed to update order status");
    }

    // Al entregar el pedido se invita al cliente a calificar los productos
    if (status === "entregado") {
        await notificarResenaPedido(id);
    }

    revalidatePath("/[slug]/dashboard/pedidos", "page");

    return { success: true, data };
}
