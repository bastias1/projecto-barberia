'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBookingStatus(id: number, status: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("reserva")
        .update({ estado: status })
        .eq("id", id);

    if (error) {
        console.error("Error updating booking status:", error);
        throw new Error("Failed to update booking status");
    }

    revalidatePath("/dashboard");
}

export async function updateOrderStatus(id: number, status: string) {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Unauthorized");
    }

    // The RLS policy will verify if user is admin/owner
    // If not, the update will fail
    const { data, error } = await supabase
        .from("venta")
        .update({ estado: status })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating order status:", error);
        if (error.code === 'PGRST116') {
            throw new Error("No tienes permisos para actualizar pedidos");
        }
        throw new Error("Failed to update order status");
    }

    console.log(`Order ${id} updated to ${status}:`, data);

    revalidatePath("/dashboard/pedidos");
    
    return { success: true, data };
}
