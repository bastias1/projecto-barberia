"use client";

import { useContext } from "react";
import GlassSurface from "@/components/react-bits/glass-surface";
import { AparienciaContext } from "@/components/apariencia-provider";
import type { Tema } from "@/lib/apariencia";

// GlassSurface necesita el radio en píxeles (cssTema redondea la tarjeta con los mismos valores)
const RADIO_PX: Record<Tema["radio"], number> = { recto: 0, pequeno: 6, medio: 12, grande: 16, pildora: 32 };

/** Capa de vidrio detrás del contenido de una `.tarjeta`; no dibuja nada si el tema no usa esa superficie. */
export function Vidrio() {
  // Sin contexto (páginas fuera de /<slug>, como /cuenta) no hay vidrio
  const tema = useContext(AparienciaContext)?.tema;
  if (tema?.superficie !== "vidrio") return null;
  const { radio } = tema;

  return (
    <div aria-hidden="true" className="vidrio pointer-events-none absolute inset-0 -z-10 m-0! border-0!">
      {/* Sin refracción: deformar el fondo dejaba manchas en las esquinas, y así se ve igual en todos los navegadores */}
      <GlassSurface width="100%" height="100%" borderRadius={RADIO_PX[radio]} backgroundOpacity={0.08} saturation={1.4} refraction={false} />
    </div>
  );
}
