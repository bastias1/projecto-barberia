import { ReviewsTable } from "@/components/dashboard/reviews/reviews-table";
import { Separator } from "@/components/ui/separator";

export default function ReviewsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Gestión de Reseñas</h3>
                <p className="text-sm text-muted-foreground">
                    Visualiza y gestiona las opiniones de los clientes.
                </p>
            </div>
            <Separator />
            <ReviewsTable />
        </div>
    );
}
