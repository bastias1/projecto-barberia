"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Barbero } from "@/lib/services/barber-service";

interface BarberSelectionProps {
  barbers: Barbero[];
  selectedBarber: Barbero | null;
  onBarberSelect: (barber: Barbero) => void;
}

export function BarberSelection({ barbers, selectedBarber, onBarberSelect }: BarberSelectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Selecciona tu Barbero</CardTitle>
          <CardDescription className="text-sm">Elige el barbero de tu preferencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {barbers.map((barber) => (
              <div
                key={barber.id}
                onClick={() => onBarberSelect(barber)}
                className={cn(
                  "p-4 md:p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                  selectedBarber?.id === barber.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {barber.nombre || "Barbero"}
                    </h3>
                    {barber.especialidad && (
                      <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                        {barber.especialidad}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
