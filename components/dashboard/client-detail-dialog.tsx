'use client';

import { useState, useEffect } from "react";
import { ClientStat } from "@/lib/services/dashboard-service";
import { fetchClientBookings, ClientBookingDetail } from "@/app/dashboard/clientes/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ClientDetailDialogProps {
  client: ClientStat | null;
  barberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

function AttendanceBadge({ percentage }: { percentage: number | null }) {
  if (percentage === null) {
    return (
      <Badge variant="outline" className="text-zinc-500 dark:text-zinc-400">
        Sin datos
      </Badge>
    );
  }
  if (percentage >= 75) {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200">
        {percentage}% asistencia
      </Badge>
    );
  }
  if (percentage >= 50) {
    return (
      <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200">
        {percentage}% asistencia
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200">
      {percentage}% asistencia
    </Badge>
  );
}

function BookingStatusBadge({ estado }: { estado: string }) {
  if (estado === "completada") {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 text-xs">
        Asistió
      </Badge>
    );
  }
  if (estado === "ausente") {
    return (
      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 text-xs">
        No asistió
      </Badge>
    );
  }
  if (estado === "cancelada") {
    return (
      <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 text-xs">
        Cancelada
      </Badge>
    );
  }
  if (estado === "confirmada") {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 text-xs">
        Confirmada
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 text-xs">
      Pendiente
    </Badge>
  );
}

function formatBookingDate(fecha: string, hora: string) {
  try {
    const dateStr = format(parseISO(fecha), "dd MMM yyyy", { locale: es });
    const time = hora.substring(0, 5);
    return `${dateStr} · ${time}`;
  } catch {
    return `${fecha} · ${hora.substring(0, 5)}`;
  }
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ClientDetailDialog({
  client,
  barberId,
  open,
  onOpenChange,
}: ClientDetailDialogProps) {
  const [bookings, setBookings] = useState<ClientBookingDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && client) {
      setLoading(true);
      fetchClientBookings(barberId, client.correo)
        .then(setBookings)
        .finally(() => setLoading(false));
    } else {
      setBookings([]);
    }
  }, [open, client, barberId]);

  const todayStr = getTodayStr();
  const upcoming = bookings
    .filter(
      (b) =>
        b.fecha >= todayStr &&
        (b.estado === "pendiente" || b.estado === "confirmada")
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
  const past = bookings
    .filter(
      (b) =>
        !(
          b.fecha >= todayStr &&
          (b.estado === "pendiente" || b.estado === "confirmada")
        )
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalle del cliente</DialogTitle>
          {/* Client header */}
          <div className="flex items-center gap-4 pt-2">
            <div className="h-14 w-14 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-lg font-bold text-blue-600 dark:text-blue-400">
              {getInitials(client.nombre, client.apellido)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight truncate">
                {client.nombre} {client.apellido}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                {client.correo}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {client.telefono || "—"}
              </p>
            </div>
            <div className="flex-shrink-0">
              <AttendanceBadge percentage={client.attendance_percentage} />
            </div>
          </div>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          {[
            { label: "Total", value: client.total_reservas },
            { label: "Asistidas", value: client.completadas },
            { label: "Ausentes", value: client.ausentes },
            { label: "Canceladas", value: client.canceladas },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-muted/50 rounded-lg px-3 py-2 text-center"
            >
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Booking history */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Sin citas registradas
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Próximas citas
                  </p>
                  <div className="divide-y rounded-md border">
                    {upcoming.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between px-3 py-2.5 gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {booking.servicio_nombre || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatBookingDate(booking.fecha, booking.hora)}
                          </p>
                        </div>
                        <BookingStatusBadge estado={booking.estado} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Historial de citas
                  </p>
                  <div className="divide-y rounded-md border">
                    {past.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between px-3 py-2.5 gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {booking.servicio_nombre || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatBookingDate(booking.fecha, booking.hora)}
                          </p>
                        </div>
                        <BookingStatusBadge estado={booking.estado} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
