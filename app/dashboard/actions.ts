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
