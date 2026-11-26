"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatPlazo } from "@/lib/barberia";
import { formatCLP, formatFecha, toZoned } from "@/lib/datetime";
import { cambiarReserva } from "@/app/[slug]/(publico)/reprogramar/actions";

/** Fila de la RPC mis_reservas. */
export interface ReservaCuenta {
  id_reserva: number;
  fecha_hora_inicio: string;
  estado: string;
  monto: number;
  es_invitado: boolean;
  id_barberia: string;
  barberia: string;
  slug: string;
  barberia_activa: boolean;
  plazo_cancelacion_min: number;
  id_sucursal: number;
  sucursal: string;
  zona_horaria: string;
  id_profesional: string;
  barbero: string;
  id_servicio: number;
  servicio: string;
  servicio_precio: number;
  duracion_min: number;
}

const ESTADOS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

/** HU-22: reservas de la cuenta en todas las barberías, con cancelar y cambiar la hora. */
export function HistorialReservas({ reservas }: { reservas: ReservaCuenta[] }) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState<number | null>(null);

  const cancelar = async (id: number) => {
    setCancelando(id);
    const result = await cambiarReserva({ id });
    setCancelando(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Cita cancelada");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Mis reservas</CardTitle>
        <CardDescription>Reservas hechas con tu cuenta o con tu correo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
          {reservas.map((r) => {
            const { fecha, hora } = toZoned(r.fecha_hora_inicio, r.zona_horaria);
            // El plazo para cambiarla lo decide la BD
            const modificable = r.barberia_activa && ["pendiente", "confirmada"].includes(r.estado) && Date.parse(r.fecha_hora_inicio) > Date.now();
            return (
              <li key={r.id_reserva} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.servicio} con {r.barbero}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.barberia} · {formatFecha(fecha, "EEEE d 'de' MMMM yyyy")}, {hora} · {formatCLP(r.monto)}
                  </p>
                  {modificable && (
                    <p className="text-xs text-muted-foreground">Cambios hasta {formatPlazo(r.plazo_cancelacion_min)} antes.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.estado === "cancelada" || r.estado === "no_asistio" ? "outline" : "secondary"}>
                    {ESTADOS[r.estado] ?? r.estado}
                  </Badge>
                  {modificable && (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${r.slug}/reprogramar?id=${r.id_reserva}`}>Cambiar la hora</Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={cancelando === r.id_reserva}>Cancelar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {r.servicio} con {r.barbero}, {formatFecha(fecha, "EEEE d 'de' MMMM")} a las {hora}. El horario quedará libre para otra persona.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Volver</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelar(r.id_reserva)}>Sí, cancelar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
