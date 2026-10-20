"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
          {barbers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💈</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                No barberos existen
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No hay barberos disponibles en este momento
              </p>
            </div>
          ) : (
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
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage
                        src={barber.profile_image || undefined}
                        alt={barber.nombre || "Barbero"}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                        {barber.nombre ? barber.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'BB'}
                      </AvatarFallback>
                    </Avatar>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
