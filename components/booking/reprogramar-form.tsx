"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { useBarberia } from "@/components/barberia-provider";
import { getAvailableTimeSlots, type TimeSlot } from "@/lib/services/booking-service";
import { localDateString } from "@/lib/datetime";
import { cambiarReserva } from "@/app/[slug]/reprogramar/actions";

interface Props {
  idReserva: number;
  token: string | null | undefined; // link firmado del correo (sin sesión)
  barberoId: string;
  servicio: { id: number; nombre: string; descripcion: string | null; precio: number };
  duracion: number;
  actual: string; // fecha y hora actuales, ya formateadas
  plazo: string;  // "2 horas"
}

/** HU-22: nueva fecha y hora para una reserva (mismo barbero y servicio). */
export function ReprogramarForm({ idReserva, token, barberoId, servicio, duracion, actual, plazo }: Props) {
  const barberia = useBarberia();
  const router = useRouter();
  const [fecha, setFecha] = useState<Date>();
  const [hora, setHora] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    getAvailableTimeSlots(barberia.id_barberia, fecha, barberoId, duracion).then((s) => {
      if (!vigente) return;
      setSlots(s);
      setHora((h) => (s.some((x) => x.hora === h) ? h : ""));
    });
    return () => { vigente = false; };
  }, [barberia.id_barberia, fecha, barberoId, duracion]);

  const confirmar = async () => {
    const slot = slots.find((s) => s.hora === hora);
    if (!fecha || !slot || guardando) return;
    setGuardando(true);
    const result = await cambiarReserva({ id: idReserva, token, nueva: { fecha: localDateString(fecha), hora: slot.hora, idSucursal: slot.idSucursal } });
    setGuardando(false);
    if (!result.success) {
      toast.error(result.error);
      // El horario pudo tomarse recién: se vuelve a pedir la disponibilidad
      setFecha(new Date(fecha));
      return;
    }
    setListo(true);
  };

  if (listo) {
    return (
      <div role="status" className="text-center space-y-4 mt-8">
        <CheckCircle2 className="size-12 mx-auto" aria-hidden="true" />
        <p className="text-lg font-semibold">Tu cita quedó para las {hora} del {fecha?.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}.</p>
        <p className="text-muted-foreground">Te enviamos un correo con los nuevos datos.</p>
        <Button asChild className="h-12"><Link href={`/${barberia.slug}`}>Volver a {barberia.nombre}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-muted-foreground">
        Hoy está agendada para el {actual}. Puedes cambiarla hasta {plazo} antes de la cita.
      </p>
      <DateTimeSelection
        selectedService={servicio}
        selectedDate={fecha}
        selectedTime={hora}
        timeSlots={slots.map((s) => s.hora)}
        onDateSelect={setFecha}
        onTimeSelect={setHora}
        onBack={() => router.back()}
        onContinue={confirmar}
        continueLabel={guardando ? "Guardando..." : "Cambiar la hora"}
      />
    </div>
  );
}
