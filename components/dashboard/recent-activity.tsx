import { createClient } from "@/utils/supabase/server";
import { getUpcomingAppointments, getRecentBookings } from "@/lib/services/dashboard-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function RecentActivity() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const upcomingAppointments = await getUpcomingAppointments(user.id, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Próximas Citas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No tienes citas próximas
          </p>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {appointment.guest_usuario?.nombre} {appointment.guest_usuario?.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.servicio?.nombre || "Sin servicio"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {appointment.hora}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(appointment.fecha), "dd MMM", { locale: es })}
                    </span>
                    <Badge className={appointment.estado === "confirmada" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-xs" : appointment.estado === "cancelada" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 text-xs" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-xs"}>
                      {appointment.estado === "confirmada" ? "✓" : appointment.estado === "cancelada" ? "✗" : "⏳"}
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
