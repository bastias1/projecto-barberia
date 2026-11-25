"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModulos } from "@/components/barberia-provider";
import { MENSAJE_BORRADOR, MENSAJE_LISTA, type PaginaPrevia } from "@/components/vista-previa";
import { tieneModulo, type ModuloCodigo } from "@/lib/modulos";
import type { Apariencia } from "@/lib/apariencia";

// Páginas que se pueden mirar en la vista previa (sus botones están desactivados, no se puede navegar)
const PAGINAS: { id: PaginaPrevia; nombre: string; modulo?: ModuloCodigo }[] = [
  { id: "inicio", nombre: "Inicio" },
  { id: "reserva", nombre: "Reservar", modulo: "agenda" },
  { id: "tienda", nombre: "Tienda", modulo: "ecommerce" },
];

/** La página real en un iframe; el escritorio se dibuja a 1280 px y se escala al ancho disponible. */
export function VistaPrevia({ slug, apariencia }: { slug: string; apariencia: Apariencia }) {
  const [movil, setMovil] = useState(false);
  const [ancho, setAncho] = useState(0);
  const [pagina, setPagina] = useState<PaginaPrevia>("inicio");
  const modulos = useModulos();
  const marco = useRef<HTMLIFrameElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const borrador = useRef({ apariencia, pagina });
  const envio = useRef<number | undefined>(undefined);
  const enviar = useCallback(() => {
    marco.current?.contentWindow?.postMessage({ tipo: MENSAJE_BORRADOR, ...borrador.current }, window.location.origin);
  }, []);

  // Arrastrar en el selector de color cambia el borrador en cada movimiento: la página se redibuja a lo más cada 100 ms
  useEffect(() => {
    borrador.current = { apariencia, pagina };
    envio.current ??= window.setTimeout(() => {
      envio.current = undefined;
      enviar();
    }, 100);
  }, [apariencia, pagina, enviar]);

  useEffect(() => {
    // la página avisa cuando ya puede recibir
    const recibir = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === marco.current?.contentWindow && e.data?.tipo === MENSAJE_LISTA) enviar();
    };
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, [enviar]);

  useEffect(() => {
    const observador = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    observador.observe(contenedor.current!);
    return () => observador.disconnect();
  }, []);

  // El ancho de esta ventana: así la foto de portada se recorta igual que en la página que ve quien edita
  const [anchoVentana, setAnchoVentana] = useState(1280);
  useEffect(() => {
    const medir = () => setAnchoVentana(Math.max(1280, window.innerWidth));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  const anchoPagina = movil ? 390 : anchoVentana;
  const escala = ancho ? Math.min(1, ancho / anchoPagina) : 1;
  const alto = 640;

  return (
    <div className="min-w-0 space-y-3 xl:sticky xl:top-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Vista previa</h2>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant={movil ? "ghost" : "secondary"} aria-pressed={!movil} aria-label="Ver como computador" onClick={() => setMovil(false)}>
            <Monitor className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" size="icon" variant={movil ? "secondary" : "ghost"} aria-pressed={movil} aria-label="Ver como teléfono" onClick={() => setMovil(true)}>
            <Smartphone className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex gap-1" role="group" aria-label="Página que se muestra">
        {PAGINAS.filter((p) => !p.modulo || tieneModulo(modulos, p.modulo)).map((p) => (
          <Button key={p.id} type="button" size="sm" variant={pagina === p.id ? "secondary" : "ghost"} aria-pressed={pagina === p.id} onClick={() => setPagina(p.id)}>
            {p.nombre}
          </Button>
        ))}
      </div>
      <div ref={contenedor} className="overflow-hidden rounded-xl border border-border" style={{ height: alto }}>
        <iframe
          ref={marco}
          src={`/${slug}`}
          title="Vista previa de tu página"
          // en pantallas angostas queda bajo los controles: no carga hasta acercarse
          loading="lazy"
          tabIndex={-1}
          className="mx-auto block origin-top-left bg-background"
          style={{ width: anchoPagina, height: alto / escala, transform: `scale(${escala})` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Es solo una muestra: Reservar y Tienda usan datos de ejemplo y nada se puede pulsar.</p>
    </div>
  );
}
