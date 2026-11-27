"use client"

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useBarberiaHref } from "@/components/barberia-provider";
import type { Sucursal } from "@/lib/barberia";

interface Service {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
}

interface Barbero {
  id: string;
  nombre: string | null;
  especialidad: string | null;
}

interface BookingConfirmationProps {
  selectedBarber: Barbero;
  selectedService: Service;
  selectedDate: Date;
  selectedTime: string;
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  sucursal: Sucursal | null;
  onNewBooking: () => void;
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm sm:text-base">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function BookingConfirmation({
  selectedBarber,
  selectedService,
  selectedDate,
  selectedTime,
  formData,
  sucursal,
  onNewBooking
}: BookingConfirmationProps) {
  const href = useBarberiaHref();

  return (
    <div role="status">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-brand text-brand-foreground">
          <Check className="size-7" aria-hidden="true" />
        </span>
        <h2 className="display text-3xl">Reserva agendada</h2>
        <p className="mt-2 text-muted-foreground">Te enviamos un correo a <span className="break-all text-foreground">{formData.email}</span> con los links para confirmar o cancelar.</p>
      </div>

      <dl className="divide-y divide-border tarjeta rounded-xl px-4">
        {sucursal && (
          <Fila etiqueta="Sucursal">
            {sucursal.nombre}
            <span className="block text-sm font-normal text-muted-foreground">{sucursal.direccion}, {sucursal.comuna}</span>
          </Fila>
        )}
        <Fila etiqueta="Barbero">{selectedBarber.nombre || "Barbero"}</Fila>
        <Fila etiqueta="Servicio">{selectedService.nombre}</Fila>
        <Fila etiqueta="Fecha">{format(selectedDate, "PPP", { locale: es })}</Fila>
        <Fila etiqueta="Hora"><span className="tabular">{selectedTime}</span></Fila>
        <Fila etiqueta="A nombre de">{formData.firstName} {formData.lastName}</Fila>
        <Fila etiqueta="Total"><span className="tabular text-lg font-semibold">${selectedService.precio.toLocaleString("es-CL")}</span></Fila>
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline" className="h-12 flex-1">
          <Link href={href()}>Volver al inicio</Link>
        </Button>
        <Button onClick={onNewBooking} className="h-12 flex-1">Hacer otra reserva</Button>
      </div>
    </div>
  );
}
