import { Suspense } from "react";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { AppointmentsListLoading } from "@/components/dashboard/loading-skeletons";
import { getTodayAppointments } from "@/lib/services/dashboard-service";
import { requireStaff, type StaffContext } from "@/lib/staff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AppointmentCard } from "@/components/dashboard/appointment-card";

async function TodayAppointments({ ctx }: { ctx: StaffContext }) {
  const todayAppointments = await getTodayAppointments(ctx.barberia.id_barberia, ctx.userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Citas de Hoy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todayAppointments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tienes citas programadas para hoy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <WelcomeHeader ctx={ctx} />

      {/* Today's Appointments */}
      <Suspense fallback={<AppointmentsListLoading />}>
        <TodayAppointments ctx={ctx} />
      </Suspense>

      {/* Upcoming Appointments */}
      <Suspense fallback={<AppointmentsListLoading />}>
        <RecentActivity ctx={ctx} />
      </Suspense>
    </div>
  );
}
