"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Opción seleccionable de un paso (sucursal, barbero, servicio): botón de >=64px con estado marcado. */
export function OpcionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "tarjeta flex min-h-16 w-full items-center gap-3 rounded-xl p-4 text-left transition-colors",
        selected ? "border-primary bg-accent" : "hover:bg-muted",
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <span
        aria-hidden="true"
        className={cn("grid size-6 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

export function TituloPaso({ titulo, ayuda }: { titulo: string; ayuda?: string }) {
  return (
    <div className="mb-5">
      <h2 className="display text-2xl sm:text-3xl">{titulo}</h2>
      {ayuda && <p className="mt-1 text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
