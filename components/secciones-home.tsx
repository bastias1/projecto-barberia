"use client";

import { Fragment } from "react";
import { useApariencia } from "@/components/apariencia-provider";
import type { SeccionId } from "@/lib/apariencia";

/** Secciones de la página de inicio en el orden elegido por la barbería. */
export function SeccionesHome({ nodos }: { nodos: Record<SeccionId, React.ReactNode> }) {
  const { secciones } = useApariencia();
  return secciones.filter((s) => s.visible).map((s) => <Fragment key={s.id}>{nodos[s.id]}</Fragment>);
}
