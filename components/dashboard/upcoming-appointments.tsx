import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import type { Appointment } from "@/lib/services/dashboard-service";
import { formatFecha } from "@/lib/datetime";

interface UpcomingAppointmentsProps {
  appointments: Appointment[];
}

export function UpcomingAppointments({ appointments }: UpcomingAppointmentsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Próximas Citas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay citas próximas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-zinc-500" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {appointment.cliente?.nombre} {appointment.cliente?.apellido}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Badge variant="secondary">
                      {appointment.servicio?.nombre}
                    </Badge>
                    <Badge className={appointment.estado === "confirmada" || appointment.estado === "completada" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50" : appointment.estado === "cancelada" || appointment.estado === "no_asistio" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"}>
                      {appointment.estado === "confirmada" ? "✓ Confirmada" : appointment.estado === "completada" ? "✓ Completada" : appointment.estado === "cancelada" ? "✗ Cancelada" : appointment.estado === "no_asistio" ? "✗ Ausente" : "⏳ Pendiente"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatFecha(appointment.fecha)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {appointment.hora}
                  </div>
                </div>
                {appointment.cliente?.telefono && (
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    📱 {appointment.cliente.telefono}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
