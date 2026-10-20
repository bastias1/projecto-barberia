import { ServicesManager } from "@/components/dashboard/services/services-manager";
import { requireStaff } from "@/lib/staff-context";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
    const ctx = await requireStaff((await params).slug);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Servicios</h2>
                <p className="text-muted-foreground">
                    {ctx.isAdmin
                        ? "Gestiona los servicios disponibles y selecciona los que ofreces."
                        : "Selecciona los servicios que ofreces."}
                </p>
            </div>

            <ServicesManager
                barberId={ctx.userId}
                canManageCatalog={ctx.isAdmin}
                isProfesional={ctx.isProfesional}
            />
        </div>
    );
}
