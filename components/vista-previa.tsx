"use client";

import { createContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { leerApariencia, type Apariencia } from "@/lib/apariencia";

// La página dentro del iframe del editor de Apariencia: recibe el borrador, no deja pulsar nada
// y puede mostrar páginas de ejemplo. Fuera de ese iframe no hace nada.

/** Qué muestra la vista previa: el inicio real, o Reservar y Tienda con datos de ejemplo. */
export type PaginaPrevia = "inicio" | "reserva" | "tienda";

/** Mensajes entre el editor del dashboard y la página en su iframe de vista previa. */
export const MENSAJE_LISTA = "apariencia-lista";
export const MENSAJE_BORRADOR = "apariencia-borrador";

/** Dentro de una página de ejemplo de la vista previa: nada debe consultar la base. */
export const MuestraContext = createContext(false);

// Solo se descarga dentro del editor
const Muestra = dynamic(() => import("@/components/vista-previa-muestras").then((m) => m.Muestra), { ssr: false });

/** `borrador` es null fuera del editor (iframe del mismo origen). */
export function useVistaPrevia(): { borrador: Apariencia | null; pagina: PaginaPrevia } {
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

  return { borrador, pagina };
}

export function PaginaConMuestra({ pagina, children }: { pagina: PaginaPrevia; children: React.ReactNode }) {
  return (
    <>
      {/* El inicio queda montado (solo oculto) para no volver a pedir sus datos al cambiar de página */}
      <div className={pagina === "inicio" ? "contents" : "hidden"}>{children}</div>
      {pagina !== "inicio" && (
        <MuestraContext.Provider value>
          <Muestra pagina={pagina} />
        </MuestraContext.Provider>
      )}
    </>
  );
}
