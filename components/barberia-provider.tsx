"use client";

import { createContext, useContext } from "react";
import type { Barberia } from "@/lib/barberia";
import { tieneModulo, type ModuloCodigo } from "@/lib/modulos";

const BarberiaContext = createContext<{ barberia: Barberia; modulos: string[]; aceptaPagos: boolean } | null>(null);

/** Expone a los Client Components la barbería de la URL (/[slug]), sus módulos vigentes y si puede cobrar. */
export function BarberiaProvider({
  barberia,
  modulos,
  aceptaPagos,
  children,
}: {
  barberia: Barberia;
  modulos: string[];
  aceptaPagos: boolean;
  children: React.ReactNode;
}) {
  return <BarberiaContext.Provider value={{ barberia, modulos, aceptaPagos }}>{children}</BarberiaContext.Provider>;
}

function useBarberiaContext() {
  const ctx = useContext(BarberiaContext);
  if (!ctx) {
    throw new Error("useBarberia debe usarse dentro de /[slug]");
  }
  return ctx;
}

export function useBarberia(): Barberia {
  return useBarberiaContext().barberia;
}

/** Módulos vigentes de la barbería según su suscripción. */
export function useModulos(): string[] {
  return useBarberiaContext().modulos;
}

/** ¿La suscripción de la barbería incluye este módulo? */
export function useModulo(codigo: ModuloCodigo): boolean {
  return tieneModulo(useBarberiaContext().modulos, codigo);
}

/** ¿La barbería conectó su Mercado Pago? Sin eso el checkout de la tienda está bloqueado. */
export function useAceptaPagos(): boolean {
  return useBarberiaContext().aceptaPagos;
}

/** Arma rutas internas de la barbería actual: href("/tienda") -> "/benjvmin/tienda". */
export function useBarberiaHref() {
  const { slug } = useBarberia();
  return (path = "") => `/${slug}${path}`;
}
