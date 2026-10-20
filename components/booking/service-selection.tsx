"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Service } from "@/lib/services/service-service";

interface ServiceSelectionProps {
  services: Service[];
  selectedService: Service | null;
  onServiceSelect: (service: Service) => void;
  onBack?: () => void;
}

export function ServiceSelection({ services, selectedService, onServiceSelect, onBack }: ServiceSelectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Selecciona un Servicio</CardTitle>
          <CardDescription className="text-sm">Elige el servicio que deseas agendar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.length === 0 && (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
              No hay servicios disponibles para este barbero
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => onServiceSelect(service)}
                className={cn(
                  "p-4 md:p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                  selectedService?.id === service.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300"
                )}
              >
                <div className="flex justify-between items-start mb-2 md:mb-3">
                  <h3 className="text-base md:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {service.nombre}
                  </h3>
                  <span className="text-base md:text-lg font-bold text-blue-600 dark:text-blue-400 ml-2">
                    ${service.precio.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1 flex-shrink-0" />
                  {service.duracion} min
                </div>
              </div>
            ))}
          </div>
          {onBack && (
            <div className="flex justify-start pt-4">
              <Button variant="outline" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Cambiar Barbero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
