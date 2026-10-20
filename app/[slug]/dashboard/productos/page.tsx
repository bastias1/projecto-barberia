import { ProductsManager } from "@/components/dashboard/products/products-manager";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { ModuloNoDisponible } from "@/components/modulo-no-disponible";

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
    // La gestión de la tienda es solo para administradores
    const ctx = await requireStaff((await params).slug, { admin: true });
    if (!(await getModulosCached(ctx.barberia.id_barberia)).includes("ecommerce")) {
        return (
            <ModuloNoDisponible
                titulo="La tienda no está incluida en tu plan"
                descripcion="Cambia a un plan que lo incluya para activarlo."
                volverHref={`/${ctx.barberia.slug}/dashboard/suscripcion`}
                volverLabel="Ver planes"
            />
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Gestión de Productos</h1>
            <ProductsManager />
        </div>
    );
}
