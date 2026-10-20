"use client"

import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Sucursal } from "@/lib/barberia";

interface SucursalSelectionProps {
  sucursales: Sucursal[];
  selected: Sucursal | null;
  onSelect: (sucursal: Sucursal) => void;
}

export function SucursalSelection({ sucursales, selected, onSelect }: SucursalSelectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Selecciona la Sucursal</CardTitle>
          <CardDescription className="text-sm">Elige dónde quieres atenderte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {sucursales.map((sucursal) => (
              <button
                type="button"
                key={sucursal.id_sucursal}
                onClick={() => onSelect(sucursal)}
                className={cn(
                  "p-4 md:p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg hover:scale-[1.02]",
                  selected?.id_sucursal === sucursal.id_sucursal
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {sucursal.nombre}
                    </h3>
                    <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                      {sucursal.direccion}, {sucursal.comuna}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
