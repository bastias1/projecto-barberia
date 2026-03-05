"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Appointment } from "@/lib/services/dashboard-service";

interface AppointmentsListProps {
  appointments: Appointment[];
}

export function AppointmentsList({ appointments }: AppointmentsListProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = appointments.filter(apt => new Date(apt.fecha) >= today);
  const past = appointments.filter(apt => new Date(apt.fecha) < today);

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left side - Client & Service Info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                  {appointment.guest_usuario?.nombre} {appointment.guest_usuario?.apellido}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {appointment.servicio?.nombre}
                  </Badge>
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-xs">
                    ${appointment.servicio?.precio.toLocaleString()}
                  </Badge>
                  <Badge className={appointment.estado === "confirmada" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-xs" : appointment.estado === "cancelada" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 text-xs" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-xs"}>
                    {appointment.estado === "confirmada" ? "✓ Confirmada" : appointment.estado === "cancelada" ? "✗ Cancelada" : "⏳ Pendiente"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400 pl-[52px]">
              {appointment.guest_usuario?.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {appointment.guest_usuario.telefono}
                </div>
              )}
              {appointment.guest_usuario?.correo && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {appointment.guest_usuario.correo}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Date & Time */}
          <div className="flex flex-col items-start md:items-end gap-2 md:text-right">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {format(new Date(appointment.fecha + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Clock className="h-4 w-4" />
              <span>{appointment.hora.substring(0, 5)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="upcoming">
          Próximas ({upcoming.length})
        </TabsTrigger>
        <TabsTrigger value="past">
          Pasadas ({past.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="space-y-4 mt-6">
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-16 w-16 text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400 text-center">
                No tienes citas próximas
              </p>
            </CardContent>
          </Card>
        ) : (
          upcoming.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))
        )}
      </TabsContent>

      <TabsContent value="past" className="space-y-4 mt-6">
        {past.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-16 w-16 text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400 text-center">
                No hay citas pasadas
              </p>
            </CardContent>
          </Card>
        ) : (
          past.reverse().map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
