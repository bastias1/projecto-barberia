import { ProductsManager } from "@/components/dashboard/products/products-manager";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Check user role
    const { data: barber } = await supabase
        .from("barberos")
        .select("rol")
        .eq("user_id", user.id)
        .single();

    // Redirect if role is 'barbero' (unauthorized)
    if (barber?.rol === "barbero") {
        redirect("/dashboard");
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Gestión de Productos</h1>
            <ProductsManager />
        </div>
    );
}
