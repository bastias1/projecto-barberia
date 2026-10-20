import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sección apagada porque la suscripción de la barbería no incluye el módulo (o venció). */
export function ModuloNoDisponible({
  titulo,
  descripcion,
  volverHref,
  volverLabel = "Volver",
}: {
  titulo: string;
  descripcion: string;
  volverHref?: string;
  volverLabel?: string;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
      <div className="h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <Lock className="h-6 w-6 text-zinc-500" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{titulo}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{descripcion}</p>
      {volverHref && (
        <Link href={volverHref}>
          <Button variant="outline">{volverLabel}</Button>
        </Link>
      )}
    </div>
  );
}
