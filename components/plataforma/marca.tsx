import Link from "next/link";
import { Sun } from "lucide-react";
import { PLATAFORMA } from "@/lib/plataforma";

/** Marca de la plataforma. Única fuente para header, auth y footer. */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex min-h-11 items-center gap-2 ${className}`} aria-label={`${PLATAFORMA.nombre}, inicio`}>
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">
        <Sun className="size-4" />
      </span>
      <span className="display text-xl">{PLATAFORMA.nombre}</span>
    </Link>
  );
}
