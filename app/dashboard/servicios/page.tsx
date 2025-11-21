import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ServicesManager } from "@/components/dashboard/services/services-manager";

export default async function ServicesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Get barber ID (same as user ID for now, but good to verify they are a barber)
    const { data: barber } = await supabase
        .from("barbero")
        .select("id")
        .eq("id", user.id)
        .single();

    if (!barber) {
        // If not a barber, they shouldn't be here (layout handles creation, but safety check)
        redirect("/dashboard");
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Servicios</h2>
                <p className="text-muted-foreground">
                    Gestiona los servicios disponibles y selecciona los que ofreces.
                </p>
            </div>

            <ServicesManager barberId={barber.id} />
        </div>
    );
}
