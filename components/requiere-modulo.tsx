"use client";

import { useBarberia, useModulo } from "@/components/barberia-provider";
import { ModuloNoDisponible } from "@/components/modulo-no-disponible";
import { TEXTO_PUBLICO, type ModuloPublico } from "@/lib/modulos";

/** Muestra el contenido solo si la suscripción de la barbería incluye el módulo. */
export function RequiereModulo({ modulo, children }: { modulo: ModuloPublico; children: React.ReactNode }) {
  const activo = useModulo(modulo);
  const barberia = useBarberia();
  if (activo) return <>{children}</>;
  return (
    <ModuloNoDisponible
      {...TEXTO_PUBLICO[modulo]}
      volverHref={`/${barberia.slug}`}
      volverLabel={`Volver a ${barberia.nombre}`}
    />
  );
}
