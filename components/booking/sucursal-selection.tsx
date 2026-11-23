"use client"

import { MapPin } from "lucide-react";
import type { Sucursal } from "@/lib/barberia";
import { OpcionCard, TituloPaso } from "./opcion-card";

interface SucursalSelectionProps {
  sucursales: Sucursal[];
  selected: Sucursal | null;
  onSelect: (sucursal: Sucursal) => void;
}

export function SucursalSelection({ sucursales, selected, onSelect }: SucursalSelectionProps) {
  return (
    <div>
      <TituloPaso titulo="Elige la sucursal" ayuda="Dónde quieres atenderte" />
      <div className="grid gap-3 sm:grid-cols-2">
        {sucursales.map((s) => (
          <OpcionCard key={s.id_sucursal} selected={selected?.id_sucursal === s.id_sucursal} onClick={() => onSelect(s)}>
            <p className="flex items-center gap-2 font-semibold"><MapPin className="size-4 shrink-0" aria-hidden="true" />{s.nombre}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.direccion}, {s.comuna}</p>
          </OpcionCard>
        ))}
      </div>
    </div>
  );
}
