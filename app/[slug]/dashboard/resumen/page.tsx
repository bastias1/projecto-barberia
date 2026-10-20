import { Suspense } from "react";
import { RecentBookings } from "@/components/dashboard/recent-bookings";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { QuickStats } from "@/components/dashboard/quick-stats";
import {
  getUpcomingAppointments,
  getRecentBookings,
} from "@/lib/services/dashboard-service";
import { QuickStatsLoading } from "@/components/dashboard/loading-skeletons";
import { requireStaff } from "@/lib/staff-context";

export default async function ResumenPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug);
  const idBarberia = ctx.barberia.id_barberia;

  // Fetch dashboard data
  const [upcomingAppointments, recentBookings] = await Promise.all([
    getUpcomingAppointments(idBarberia, ctx.userId),
    getRecentBookings(idBarberia, ctx.userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Resumen de Actividad
        </h1>
        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
          Vista general de tus estadísticas y reservas
        </p>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<QuickStatsLoading />}>
        <QuickStats ctx={ctx} />
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
