"use client"

import { Clock } from "lucide-react";
import { Service } from "@/lib/services/service-service";
import { OpcionCard, TituloPaso } from "./opcion-card";

interface ServiceSelectionProps {
  services: Service[];
  selectedService: Service | null;
  onServiceSelect: (service: Service) => void;
}

export function ServiceSelection({ services, selectedService, onServiceSelect }: ServiceSelectionProps) {
  return (
    <div>
      <TituloPaso titulo="Elige el servicio" ayuda="Qué quieres hacerte" />
      {services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
          Este barbero aún no tiene servicios. Vuelve atrás y elige a otro.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <OpcionCard key={s.id} selected={selectedService?.id === s.id} onClick={() => onServiceSelect(s)}>
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold">{s.nombre}</span>
                <span className="tabular font-semibold">${s.precio.toLocaleString("es-CL")}</span>
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" />{s.duracion} min</span>
            </OpcionCard>
          ))}
        </div>
      )}
    </div>
  );
}
