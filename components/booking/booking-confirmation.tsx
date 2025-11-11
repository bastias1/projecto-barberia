"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

interface Service {
  id: number;
  name: string;
  duration: number;
  price: number;
}

interface BookingConfirmationProps {
  selectedService: Service;
  selectedDate: Date;
  selectedTime: string;
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  onNewBooking: () => void;
}

export function BookingConfirmation({
  selectedService,
  selectedDate,
  selectedTime,
  formData,
  onNewBooking
}: BookingConfirmationProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2 border-green-500">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">¡Reserva Confirmada!</CardTitle>
          <CardDescription>Tu cita ha sido agendada exitosamente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Servicio:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedService.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Fecha:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {format(selectedDate, "PPP", { locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Hora:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Cliente:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formData.firstName} {formData.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Email:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Teléfono:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formData.phone}</span>
            </div>
            <div className="pt-3 border-t border-zinc-300 dark:border-zinc-700 flex justify-between text-lg">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Total:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                ${selectedService.price.toLocaleString()}
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Te hemos enviado un correo de confirmación a {formData.email}
          </p>

          <div className="flex gap-3">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Volver al Inicio
              </Button>
            </Link>
            <Button onClick={onNewBooking} className="flex-1">
              Nueva Reserva
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
