"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  onDateSelect: (date: Date | undefined) => void;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string; // p. ej. "Cambiar la hora" al reprogramar
}

export function DateTimeSelection({
  selectedService,
  selectedDate,
  selectedTime,
  timeSlots,
  proximaFecha,
  onDateSelect,
  onTimeSelect,
  onBack,
  onContinue,
  continueLabel = "Continuar"
}: DateTimeSelectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Selecciona Fecha y Hora</CardTitle>
          <CardDescription className="text-sm">
            Servicio: {selectedService.nombre} - ${selectedService.precio.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block text-sm md:text-base">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm md:text-base",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { locale: es })
                  ) : (
                    <span>Selecciona una fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={onDateSelect}
                  disabled={(date) => {
                    // Block Sundays
                    if (date.getDay() === 0) return true;
                    
                    // Block dates before today (but allow today)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);
                    
                    return checkDate < today;
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="mb-3 block text-sm md:text-base">Horario</Label>
            {!selectedDate ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecciona una fecha primero</p>
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold mb-1">No hay horarios disponibles</p>
                <div role="status">
                  {proximaFecha === "buscando" ? (
                    <p className="text-xs">Buscando la fecha más próxima con horarios…</p>
                  ) : proximaFecha ? (
                    <>
                      <p className="text-xs mb-3">La fecha más próxima con horarios es el {format(proximaFecha, "EEEE d 'de' MMMM", { locale: es })}.</p>
                      <Button variant="outline" size="sm" onClick={() => onDateSelect(proximaFecha)}>
                        Ver ese día
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs">El barbero no tiene horarios configurados para este día o está completamente reservado</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
                {timeSlots.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    onClick={() => onTimeSelect(time)}
                    className="w-full text-sm md:text-base"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 md:gap-3 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atrás
            </Button>
            <Button 
              onClick={onContinue} 
              disabled={!selectedDate || !selectedTime}
              className="flex-1"
            >
              {continueLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
