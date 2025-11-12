import { QuickStatsLoading, AppointmentsListLoading } from "@/components/dashboard/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome Header Loading */}
      <div className="mb-8">
        <Skeleton className="h-9 w-96 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Quick Stats Loading */}
      <QuickStatsLoading />

      {/* Recent Activity Loading */}
      <AppointmentsListLoading />
    </div>
  );
}
