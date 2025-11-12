import { Suspense } from "react";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickStatsLoading, AppointmentsListLoading } from "@/components/dashboard/loading-skeletons";

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <WelcomeHeader />

      {/* Quick Stats with Loading State */}
      <Suspense fallback={<QuickStatsLoading />}>
        <QuickStats />
      </Suspense>

      {/* Recent Activity Section */}
      <Suspense fallback={<AppointmentsListLoading />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
