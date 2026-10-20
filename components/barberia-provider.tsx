"use client";

import { createContext, useContext } from "react";
import type { Barberia } from "@/lib/barberia";

const BarberiaContext = createContext<{ barberia: Barberia; modulos: string[] } | null>(null);

/** Expone a los Client Components la barbería de la URL (/[slug]) y sus módulos vigentes. */
export function BarberiaProvider({
  barberia,
  modulos,
  children,
}: {
  barberia: Barberia;
  modulos: string[];
  children: React.ReactNode;
}) {
  return <BarberiaContext.Provider value={{ barberia, modulos }}>{children}</BarberiaContext.Provider>;
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

/** ¿La suscripción de la barbería incluye este módulo? ('agenda' | 'ecommerce' | 'bi') */
export function useModulo(codigo: string): boolean {
  return useBarberiaContext().modulos.includes(codigo);
}

/** Arma rutas internas de la barbería actual: href("/tienda") -> "/benjvmin/tienda". */
export function useBarberiaHref() {
  const { slug } = useBarberia();
  return (path = "") => `/${slug}${path}`;
}
