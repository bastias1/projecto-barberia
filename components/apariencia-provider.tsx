"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Fraunces, Inter, Oswald, Playfair_Display, Space_Grotesk } from "next/font/google";
import { useBarberia } from "@/components/barberia-provider";
import { leerApariencia, MENSAJE_BORRADOR, MENSAJE_LISTA, type Apariencia, type PaginaPrevia, type Tema } from "@/lib/apariencia";
import { cssTema, modoEfectivo } from "@/lib/apariencia-css";

// Solo se descarga dentro del editor
const Muestra = dynamic(() => import("@/components/vista-previa-muestras").then((m) => m.Muestra), { ssr: false });

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

/** Dentro de una página de ejemplo de la vista previa: nada debe consultar la base. */
export const MuestraContext = createContext(false);

export function useApariencia(): Apariencia {
  const apariencia = useContext(AparienciaContext);
  if (!apariencia) throw new Error("useApariencia debe usarse dentro de /[slug]");
  return apariencia;
}

/**
 * Apariencia de la barbería para sus páginas de cliente (el dashboard no cambia). Dentro del editor
 * (iframe del mismo origen) muestra el borrador que este le envía.
 */
export function AparienciaProvider({ children }: { children: React.ReactNode }) {
  const { slug, apariencia: guardada } = useBarberia();
  const pathname = usePathname();
  const [borrador, setBorrador] = useState<Apariencia | null>(null);
  const [pagina, setPagina] = useState<PaginaPrevia>("inicio");

  useEffect(() => {
    if (window.parent === window) return;
    const recibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.tipo !== MENSAJE_BORRADOR) return;
      setBorrador(leerApariencia(e.data.apariencia));
      setPagina(e.data.pagina === "reserva" || e.data.pagina === "tienda" ? e.data.pagina : "inicio");
    };
    window.addEventListener("message", recibir);
    window.parent.postMessage({ tipo: MENSAJE_LISTA }, window.location.origin);
    return () => window.removeEventListener("message", recibir);
  }, []);

  // En la vista previa los botones y enlaces no hacen nada; el desplazamiento y el efecto al pasar el cursor siguen
  const enVistaPrevia = borrador !== null;
  useEffect(() => {
    if (!enVistaPrevia) return;
    const bloquear = (e: Event) => {
      if (e.target === document.documentElement) return; // barra de desplazamiento
      if (e instanceof KeyboardEvent && (e.target === document.body || !["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key))) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const eventos = ["click", "auxclick", "dblclick", "contextmenu", "pointerdown", "mousedown", "keydown", "submit"];
    eventos.forEach((tipo) => window.addEventListener(tipo, bloquear, true));
    return () => eventos.forEach((tipo) => window.removeEventListener(tipo, bloquear, true));
  }, [enVistaPrevia]);

  useEffect(() => {
    if (enVistaPrevia) window.scrollTo(0, 0);
  }, [enVistaPrevia, pagina]);

  const apariencia = borrador ?? leerApariencia(guardada);
  const { tema } = apariencia;
  const conTema = !pathname.startsWith(`/${slug}/dashboard`);
  const modo = modoEfectivo(tema);

  return (
    <AparienciaContext.Provider value={apariencia}>
      {/* Los valores del CSS vienen de listas cerradas y colores #rrggbb (leerApariencia) */}
      {conTema && <style dangerouslySetInnerHTML={{ __html: cssTema(tema, FAMILIAS[tema.fuente]) }} />}
      {/* globals.css lee este marcador para fijar claro u oscuro */}
      {conTema && modo && <span data-modo={modo} hidden />}
      {/* El inicio queda montado (solo oculto) para no volver a pedir sus datos al cambiar de página */}
      <div className={pagina === "inicio" ? "contents" : "hidden"}>{children}</div>
      {pagina !== "inicio" && (
        <MuestraContext.Provider value>
          <Muestra pagina={pagina} />
        </MuestraContext.Provider>
      )}
    </AparienciaContext.Provider>
  );
}
