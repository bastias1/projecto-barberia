import { ProductsManager } from "@/components/dashboard/products/products-manager";
import { Separator } from "@/components/ui/separator";

export default function ProductsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Productos</h3>
                <p className="text-sm text-muted-foreground">
                    Gestiona el inventario de productos de la tienda.
                </p>
            </div>
            <Separator />
            <ProductsManager />
        </div>
    );
}
