'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Appointment } from "@/lib/services/dashboard-service";
import { Calendar, Check, Clock, User, X } from "lucide-react";
import { updateBookingStatus } from "@/app/dashboard/actions";
import { useState } from "react";
import { toast } from "sonner";

interface AppointmentCardProps {
    appointment: Appointment;
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleStatusUpdate = async (status: string) => {
        try {
            setIsLoading(true);
            await updateBookingStatus(appointment.id, status);
            toast.success(status === 'completada' ? 'Cita marcada como completada' : 'Cita marcada como ausente');
        } catch (error) {
            toast.error('Error al actualizar el estado de la cita');
        } finally {
            setIsLoading(false);
        }
    };

    const isPending = !['completada', 'ausente', 'cancelada'].includes(appointment.estado || '');

    return (
        <div
            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
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
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {appointment.hora}
                    </Badge>
                    <Badge className={
                        appointment.estado === "confirmada" || appointment.estado === "completada"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 text-xs"
                            : appointment.estado === "cancelada" || appointment.estado === "ausente"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 text-xs"
                                : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-xs"
                    }>
                        {appointment.estado === "confirmada" ? "✓ Confirmada"
                            : appointment.estado === "completada" ? "✓ Completada"
                                : appointment.estado === "cancelada" ? "✗ Cancelada"
                                    : appointment.estado === "ausente" ? "✗ Ausente"
                                        : "⏳ Pendiente"}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    ${appointment.servicio?.precio.toFixed(2) || "0.00"}
                </p>
                {isPending && (
                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleStatusUpdate('completada')}
                            disabled={isLoading}
                            title="Marcar como asistió"
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleStatusUpdate('ausente')}
                            disabled={isLoading}
                            title="Marcar como ausente"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
