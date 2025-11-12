import { createClient } from "@/utils/supabase/server";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentBookings } from "@/components/dashboard/recent-bookings";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import {
  getDashboardStats,
  getUpcomingAppointments,
  getRecentBookings,
} from "@/lib/services/dashboard-service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ResumenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch all dashboard data using service functions
  const stats = await getDashboardStats(user.id);
  const upcomingAppointments = await getUpcomingAppointments(user.id);
  const recentBookings = await getRecentBookings(user.id);

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Resumen de Actividad
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Vista general de tus estadísticas y reservas
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <DashboardStats
        todayCount={stats.todayCount}
        weekCount={stats.weekCount}
        monthCount={stats.monthCount}
        clientCount={stats.clientCount}
      />

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
