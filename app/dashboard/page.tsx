import { Suspense } from "react";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { AppointmentsListLoading } from "@/components/dashboard/loading-skeletons";
import { createClient } from "@/utils/supabase/server";
import { getTodayAppointments } from "@/lib/services/dashboard-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

async function TodayAppointments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const todayAppointments = await getTodayAppointments(user.id);

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
              <div
                key={appointment.id}
                className="flex items-start gap-3 p-3 rounded-lg border-2 hover:bg-accent transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {appointment.guest_usuario?.nombre} {appointment.guest_usuario?.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.servicio?.nombre || "Sin servicio"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {appointment.hora}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    ${appointment.servicio?.precio.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <WelcomeHeader />

      {/* Today's Appointments */}
      <Suspense fallback={<AppointmentsListLoading />}>
        <TodayAppointments />
      </Suspense>

      {/* Upcoming Appointments */}
      <Suspense fallback={<AppointmentsListLoading />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
