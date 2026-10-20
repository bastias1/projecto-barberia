"use client";

import { useBarberia, useModulo } from "@/components/barberia-provider";
import { ModuloNoDisponible } from "@/components/modulo-no-disponible";

const TEXTOS: Record<string, { titulo: string; descripcion: string }> = {
  ecommerce: {
    titulo: "La tienda no está disponible",
    descripcion: "Esta barbería no tiene la tienda en línea activa en este momento.",
  },
  agenda: {
    titulo: "Reservas en línea no disponibles",
    descripcion: "Esta barbería no está recibiendo reservas en línea en este momento. Contáctala directamente para agendar.",
  },
};

/** Muestra el contenido solo si la suscripción de la barbería incluye el módulo. */
export function RequiereModulo({ modulo, children }: { modulo: "ecommerce" | "agenda"; children: React.ReactNode }) {
  const activo = useModulo(modulo);
  const barberia = useBarberia();
  if (activo) return <>{children}</>;
  return (
    <ModuloNoDisponible
      {...TEXTOS[modulo]}
      volverHref={`/${barberia.slug}`}
      volverLabel={`Volver a ${barberia.nombre}`}
    />
  );
}
