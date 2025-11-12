import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Booking {
  id: number;
  fecha: string;
  hora: string;
  created_at: string;
  servicio: {
    nombre: string;
    precio: number;
  } | null;
  guest_usuario: {
    nombre: string;
    apellido: string;
  } | null;
}

interface RecentBookingsProps {
  bookings: Booking[];
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Reservas Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay reservas recientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {booking.guest_usuario?.nombre} {booking.guest_usuario?.apellido}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Reservado {format(new Date(booking.created_at), "dd MMM", { locale: es })}
                    </p>
                  </div>
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50">
                    Nueva
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{booking.servicio?.nombre}</span>
                    <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                      <DollarSign className="h-3 w-3" />
                      {booking.servicio?.precio.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    {format(new Date(booking.fecha), "dd MMM yyyy", { locale: es })} • {booking.hora}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
