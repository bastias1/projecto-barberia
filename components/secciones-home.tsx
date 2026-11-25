"use client";

import { Fragment, useEffect, useState } from "react";
import { leerApariencia, MENSAJE_BORRADOR, MENSAJE_LISTA, type SeccionConfig, type SeccionId } from "@/lib/apariencia";

/**
 * Secciones de la página de inicio en el orden elegido por la barbería. Dentro del editor
 * (iframe del mismo origen) muestra el borrador que este le envía.
 */
export function SeccionesHome({ inicial, nodos }: { inicial: SeccionConfig[]; nodos: Record<SeccionId, React.ReactNode> }) {
  const [borrador, setBorrador] = useState<SeccionConfig[] | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const recibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.tipo !== MENSAJE_BORRADOR) return;
      setBorrador(leerApariencia(e.data.apariencia).secciones);
    };
    window.addEventListener("message", recibir);
    window.parent.postMessage({ tipo: MENSAJE_LISTA }, window.location.origin);
    return () => window.removeEventListener("message", recibir);
  }, []);

  return (borrador ?? inicial).filter((s) => s.visible).map((s) => <Fragment key={s.id}>{nodos[s.id]}</Fragment>);
}
