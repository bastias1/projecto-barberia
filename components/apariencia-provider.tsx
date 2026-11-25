"use client";

import { createContext, useContext, useMemo } from "react";
import { Fraunces, Inter, Oswald, Playfair_Display, Space_Grotesk } from "next/font/google";
import { useBarberia } from "@/components/barberia-provider";
import { PaginaConMuestra, useVistaPrevia } from "@/components/vista-previa";
import type { Apariencia, Tema } from "@/lib/apariencia";
import { cssTema, modoEfectivo } from "@/lib/apariencia-css";

// Sin preload: solo se descarga la que la barbería usa
const inter = Inter({ subsets: ["latin"], preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], preload: false });
const fraunces = Fraunces({ subsets: ["latin"], preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], preload: false });
const oswald = Oswald({ subsets: ["latin"], preload: false });

export const FAMILIAS: Record<Tema["fuente"], string | null> = {
  geist: null,
  inter: inter.style.fontFamily,
  "space-grotesk": spaceGrotesk.style.fontFamily,
  fraunces: fraunces.style.fontFamily,
  playfair: playfair.style.fontFamily,
  oswald: oswald.style.fontFamily,
};

export const AparienciaContext = createContext<Apariencia | null>(null);

export function useApariencia(): Apariencia {
  const apariencia = useContext(AparienciaContext);
  if (!apariencia) throw new Error("useApariencia debe usarse dentro de /[slug]");
  return apariencia;
}

/** Apariencia de la barbería en sus páginas de cliente. Dentro del editor usa el borrador que este envía. */
export function AparienciaProvider({ children }: { children: React.ReactNode }) {
  const { apariencia: guardada } = useBarberia();
  const { borrador, pagina } = useVistaPrevia();

  const apariencia = borrador ?? guardada;
  const { tema } = apariencia;
  const modo = modoEfectivo(tema);
  const css = useMemo(() => cssTema(tema, FAMILIAS[tema.fuente]), [tema]);

  return (
    <AparienciaContext.Provider value={apariencia}>
      {/* Los valores del CSS vienen de listas cerradas y colores #rrggbb (leerApariencia, aplicada en lib/barberia.ts y en la vista previa) */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {/* globals.css lee este marcador para fijar claro u oscuro */}
      {modo && <span data-modo={modo} hidden />}
      <PaginaConMuestra pagina={pagina}>{children}</PaginaConMuestra>
    </AparienciaContext.Provider>
  );
}
