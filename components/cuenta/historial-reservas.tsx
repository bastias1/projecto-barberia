"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { esModificable } from "@/lib/reservas-cuenta";
import { cn } from "@/lib/utils";

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

/** HU-22: reservas de la cuenta; las modificables con cambiar la hora y cancelar, las demás con reservar de nuevo. */
export function ListaReservas({ reservas }: { reservas: ReservaCuenta[] }) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [ahora] = useState(() => Date.now());

  const cancelar = async (id: number) => {
    setCancelando(id);
    const result = await cambiarReserva({ id });
    setCancelando(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Cita cancelada");
    router.refresh();
  };

  return (
        <ul className="space-y-2">
          {reservas.map((r) => {
            const { fecha, hora } = toZoned(r.fecha_hora_inicio, r.zona_horaria);
            const modificable = esModificable(r, ahora);
            const inactiva = r.estado === "cancelada" || r.estado === "no_asistio";
            return (
              <li key={r.id_reserva} className={cn("tarjeta flex flex-wrap items-center justify-between gap-3 rounded-lg p-4", inactiva && "opacity-60")}>
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
                  <Badge variant={inactiva ? "outline" : "secondary"}>
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
                  {!modificable && r.barberia_activa && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${r.slug}/agendar`}><CalendarPlus className="size-4" aria-hidden="true" />Reservar de nuevo</Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
  );
}
