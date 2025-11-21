import { DashboardTableSkeleton } from "@/components/dashboard/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="h-px bg-border" />
            <DashboardTableSkeleton />
        </div>
    );
}
