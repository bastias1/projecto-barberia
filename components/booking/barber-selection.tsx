"use client"

import { Scissors } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Barbero } from "@/lib/services/barber-service";
import { OpcionCard, TituloPaso } from "./opcion-card";

interface BarberSelectionProps {
  barbers: Barbero[];
  selectedBarber: Barbero | null;
  onBarberSelect: (barber: Barbero) => void;
}

export function BarberSelection({ barbers, selectedBarber, onBarberSelect }: BarberSelectionProps) {
  return (
    <div>
      <TituloPaso titulo="Elige tu barbero" ayuda="Quién te va a atender" />
      {barbers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted"><Scissors className="size-5 text-muted-foreground" aria-hidden="true" /></span>
          <p className="font-semibold">No hay barberos disponibles</p>
          <p className="mt-1 text-sm text-muted-foreground">Esta sucursal aún no tiene barberos para reservar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {barbers.map((barber) => (
            <OpcionCard key={barber.id} selected={selectedBarber?.id === barber.id} onClick={() => onBarberSelect(barber)}>
              <span className="flex items-center gap-3">
                <Avatar className="size-12 shrink-0">
                  <AvatarImage src={barber.profile_image || undefined} alt="" />
                  <AvatarFallback className="bg-muted text-foreground">
                    {barber.nombre ? barber.nombre.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "BB"}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{barber.nombre || "Barbero"}</span>
                  {barber.especialidad && <span className="block truncate text-sm text-muted-foreground">{barber.especialidad}</span>}
                </span>
              </span>
            </OpcionCard>
          ))}
        </div>
      )}
    </div>
  );
}
