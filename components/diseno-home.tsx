"use client";

import { Fragment } from "react";
import { useApariencia } from "@/components/apariencia-provider";
import type { Apariencia, SeccionId } from "@/lib/apariencia";

// Clases de cada diseño: contenedor, bloque del encabezado y bloque de las secciones.
// El encabezado ajusta lo suyo con la variante `en-columna` (app/[slug]/(publico)/page.tsx).
const CLASES: Record<Apariencia["diseno"], { raiz?: string; encabezado?: string; secciones?: string }> = {
  clasico: {},
  columna: {
    raiz: "lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[20rem_minmax(0,1fr)]",
    // top-16 es el alto de la barra superior
    encabezado: "lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto",
    secciones: "min-w-0 lg:[&>section:first-child]:border-t-0",
  },
  // el texto va sobre el lado que queda en el color de la página, así conserva su contraste
  portada: { encabezado: "relative isolate [&>section]:w-full [&>section]:pt-60 md:flex md:min-h-[28rem] md:flex-col md:justify-center md:[&>section]:pt-16 md:[&>section>*]:max-w-[55%]" },
};

/**
 * Inicio de la barbería según su diseño y el orden de secciones elegido. El árbol es el mismo en los tres
 * diseños (solo cambian las clases) para que al cambiar de diseño en la vista previa nada se vuelva a montar.
 */
export function DisenoHome({ encabezado, nodos }: { encabezado: React.ReactNode; nodos: Record<SeccionId, React.ReactNode> }) {
  const { secciones, diseno, portada, encuadre } = useApariencia();
  const punto = `${encuadre.x}% ${encuadre.y}%`;
  const foto = diseno === "portada" ? portada : null;
  // Sin foto, "Portada" se ve como el Clásico
  const clases = CLASES[diseno === "portada" && !foto ? "clasico" : diseno];

  return (
    <div data-diseno={diseno} className={clases.raiz}>
      <div className={clases.encabezado}>
        {foto && (
          // teléfono: foto arriba que se funde hacia abajo; computador: de fondo, fundida hacia la izquierda
          <div className="absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden md:inset-0 md:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- como los logos y la galería */}
            <img src={foto} alt="" className="size-full object-cover" style={{ objectPosition: punto, transformOrigin: punto, transform: `scale(${encuadre.zoom / 100})` }} />
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 via-30% to-transparent md:bg-linear-to-r md:from-40% md:via-background/80 md:via-58% md:to-85%" />
          </div>
        )}
        {encabezado}
      </div>
      <div className={clases.secciones}>
        {secciones.filter((s) => s.visible).map((s) => <Fragment key={s.id}>{nodos[s.id]}</Fragment>)}
      </div>
    </div>
  );
}
