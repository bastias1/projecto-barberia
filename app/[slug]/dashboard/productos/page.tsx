import { ProductsManager } from "@/components/dashboard/products/products-manager";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { ModuloFueraDelPlan } from "@/components/modulo-no-disponible";
import { tieneModulo } from "@/lib/modulos";

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
    // La gestión de la tienda es solo para administradores
    const ctx = await requireStaff((await params).slug, { admin: true });
    if (!tieneModulo(await getModulosCached(ctx.barberia.id_barberia), "ecommerce")) {
        return <ModuloFueraDelPlan slug={ctx.barberia.slug} modulo="ecommerce" />;
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Gestión de Productos</h1>
            <ProductsManager />
        </div>
    );
}
