"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRight, CalendarIcon, CalendarX2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AccionesPaso } from "./acciones-paso";
import { TituloPaso } from "./opcion-card";

interface Service {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
}

interface DateTimeSelectionProps {
  selectedService: Service;
  selectedDate: Date | undefined;
  selectedTime: string;
  timeSlots: string[];
  /** HU-02: sin horarios en la fecha, la más próxima con horarios (null = ninguna; sin prop = no se busca) */
  proximaFecha?: Date | null | "buscando";
  /** true mientras se consultan los horarios de la fecha elegida */
  cargandoHorarios?: boolean;
  onDateSelect: (date: Date | undefined) => void;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string; // p. ej. "Cambiar la hora" al reprogramar
}

// Los horarios llegan como "HH:MM": se agrupan en mañana y tarde
const grupos = (slots: string[]) => [
  { nombre: "Mañana", horas: slots.filter((h) => h < "13:00") },
  { nombre: "Tarde", horas: slots.filter((h) => h >= "13:00") },
].filter((g) => g.horas.length > 0);

export function DateTimeSelection({
  selectedService,
  selectedDate,
  selectedTime,
  timeSlots,
  proximaFecha,
  cargandoHorarios = false,
  onDateSelect,
  onTimeSelect,
  onBack,
  onContinue,
  continueLabel = "Continuar"
}: DateTimeSelectionProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <TituloPaso titulo="Elige fecha y hora" ayuda={`${selectedService.nombre} · $${selectedService.precio.toLocaleString("es-CL")}`} />

      <div className="space-y-2">
        <Label htmlFor="fecha-cita">Fecha</Label>
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button id="fecha-cita" type="button" variant="outline" className="h-12 w-full justify-start gap-2 font-normal">
              <CalendarIcon className="size-4" aria-hidden="true" />
              {selectedDate
                ? <span className="first-letter:uppercase">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
                : <span className="text-muted-foreground">Elige una fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-h-(--radix-popover-content-available-height) overflow-y-auto p-0" align="start" collisionPadding={8}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onDateSelect(date);
                setAbierto(false);
              }}
              defaultMonth={selectedDate}
              disabled={(date) => {
                // Domingos cerrados
                if (date.getDay() === 0) return true;
                // Antes de hoy (hoy sí se puede)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const checkDate = new Date(date);
                checkDate.setHours(0, 0, 0, 0);
                return checkDate < today;
              }}
              locale={es}
              weekStartsOn={1}
              className="[--cell-size:2.5rem]"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-6" aria-live="polite">
        <h3 className="mb-3 font-semibold">
          {selectedDate ? `Horarios del ${format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}` : "Horarios"}
        </h3>
        {!selectedDate ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-muted-foreground">Elige un día para ver los horarios.</p>
        ) : cargandoHorarios ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Cargando horarios">
            {Array.from({ length: 8 }).map((_, i) => <span key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : timeSlots.length === 0 ? (
          <div role="status" className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <CalendarX2 className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">No hay horarios este día</p>
            {proximaFecha === "buscando" ? (
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando el próximo día con horarios…</p>
            ) : proximaFecha ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">El próximo día con horarios es el {format(proximaFecha, "EEEE d 'de' MMMM", { locale: es })}.</p>
                <Button variant="outline" className="mt-4 h-11" onClick={() => onDateSelect(proximaFecha)}>Ver ese día</Button>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">El barbero no tiene horarios para este día o está completamente reservado.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {grupos(timeSlots).map((g) => (
              <div key={g.nombre}>
                <p className="mb-2 text-sm text-muted-foreground">{g.nombre}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {g.horas.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => onTimeSelect(time)}
                      aria-pressed={selectedTime === time}
                      className="tabular h-11 w-full text-base"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AccionesPaso onBack={onBack}>
        <Button onClick={onContinue} disabled={!selectedDate || !selectedTime}>
          {continueLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </AccionesPaso>
    </div>
  );
}
