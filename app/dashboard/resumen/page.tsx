import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { RecentBookings } from "@/components/dashboard/recent-bookings";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { QuickStats } from "@/components/dashboard/quick-stats";
import {
  getUpcomingAppointments,
  getRecentBookings,
} from "@/lib/services/dashboard-service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { QuickStatsLoading, AppointmentsListLoading } from "@/components/dashboard/loading-skeletons";

export default async function ResumenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch dashboard data
  const upcomingAppointments = await getUpcomingAppointments(user.id);
  const recentBookings = await getRecentBookings(user.id);

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 md:gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Resumen de Actividad
          </h1>
          <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
            Vista general de tus estadísticas y reservas
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<QuickStatsLoading />}>
        <QuickStats />
      </Suspense>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <UpcomingAppointments appointments={upcomingAppointments} />

        {/* Recent Bookings */}
        <RecentBookings bookings={recentBookings} />
      </div>
    </div>
  );
}
