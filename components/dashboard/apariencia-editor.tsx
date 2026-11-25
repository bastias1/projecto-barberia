"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Loader2, Lock, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AparienciaDiseno, AparienciaTema } from "@/components/dashboard/apariencia-tema";
import { createClient } from "@/utils/supabase/client";
import { useModulos } from "@/components/barberia-provider";
import { tieneModulo, type ModuloCodigo } from "@/lib/modulos";
import {
  aparienciaPorDefecto, SECCION_NOMBRE,
  type Apariencia, type SeccionConfig, type SeccionId,
} from "@/lib/apariencia";
import { MENSAJE_BORRADOR, MENSAJE_LISTA, type PaginaPrevia } from "@/components/vista-previa";
import { cn } from "@/lib/utils";

const nombreDe = (id: string | number) => SECCION_NOMBRE[id as SeccionId];

// Lo que el lector de pantalla dice al arrastrar (dnd-kit lo trae en inglés)
const ACCESIBILIDAD = {
  screenReaderInstructions: {
    draggable: "Para mover una sección, presiona espacio, usa las flechas y presiona espacio para soltarla. Escape cancela.",
  },
  announcements: {
    onDragStart: ({ active }: { active: { id: string | number } }) => `Moviendo ${nombreDe(active.id)}.`,
    onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over ? `${nombreDe(active.id)} está en el lugar de ${nombreDe(over.id)}.` : undefined,
    onDragEnd: ({ active }: { active: { id: string | number } }) => `${nombreDe(active.id)} quedó en su nuevo lugar.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) => `Se canceló el movimiento de ${nombreDe(active.id)}.`,
  },
};

function Fila({ seccion, onToggle }: { seccion: SeccionConfig; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: seccion.id });
  const nombre = SECCION_NOMBRE[seccion.id];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-2 border-t border-border bg-card py-1", isDragging && "relative z-10 shadow-md")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground"
        aria-label={`Mover ${nombre}`}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className={cn("flex-1", !seccion.visible && "text-muted-foreground")}>{nombre}</span>
      {!seccion.visible && <span className="text-xs text-muted-foreground">Oculta</span>}
      <Button type="button" variant="ghost" size="icon" className="size-11" onClick={onToggle} aria-pressed={seccion.visible} aria-label={`Mostrar ${nombre}`}>
        {seccion.visible ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
      </Button>
    </li>
  );
}

// Páginas que se pueden mirar en la vista previa (sus botones están desactivados, no se puede navegar)
const PAGINAS: { id: PaginaPrevia; nombre: string; modulo?: ModuloCodigo }[] = [
  { id: "inicio", nombre: "Inicio" },
  { id: "reserva", nombre: "Reservar", modulo: "agenda" },
  { id: "tienda", nombre: "Tienda", modulo: "ecommerce" },
];

/** La página real en un iframe; el escritorio se dibuja a 1280 px y se escala al ancho disponible. */
function VistaPrevia({ slug, apariencia }: { slug: string; apariencia: Apariencia }) {
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

export function AparienciaEditor({ idBarberia, slug, inicial }: { idBarberia: string; slug: string; inicial: Apariencia }) {
  const router = useRouter();
  const [apariencia, setApariencia] = useState(inicial);
  const [guardada, setGuardada] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const sensores = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { secciones } = apariencia;
  const sinCambios = JSON.stringify(apariencia) === JSON.stringify(guardada);

  const setSecciones = (nuevas: SeccionConfig[]) => setApariencia({ ...apariencia, secciones: nuevas });

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const desde = secciones.findIndex((s) => s.id === active.id);
    const hasta = secciones.findIndex((s) => s.id === over.id);
    setSecciones(arrayMove(secciones, desde, hasta));
  };

  const guardar = async () => {
    setGuardando(true);
    // RLS: solo el admin de la barbería puede actualizarla
    const { data, error } = await createClient()
      .from("barberia")
      .update({ apariencia })
      .eq("id_barberia", idBarberia)
      .select("id_barberia");
    setGuardando(false);

    if (error || !data?.length) {
      console.error("Error updating apariencia:", error);
      toast.error("No se pudieron guardar los cambios");
      return;
    }
    setGuardada(apariencia);
    toast.success("Cambios guardados");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        <CardContent>
          <Tabs defaultValue="secciones" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="secciones">Secciones</TabsTrigger>
              <TabsTrigger value="tema">Tema</TabsTrigger>
              <TabsTrigger value="diseno">Diseño</TabsTrigger>
            </TabsList>
            <TabsContent value="diseno">
              <AparienciaDiseno idBarberia={idBarberia} apariencia={apariencia} onChange={setApariencia} />
            </TabsContent>
            <TabsContent value="tema">
              <AparienciaTema tema={apariencia.tema} onChange={(tema) => setApariencia({ ...apariencia, tema })} />
            </TabsContent>
            <TabsContent value="secciones">
              <p className="mb-3 text-sm text-muted-foreground">Arrastra para ordenar. Una sección sin contenido no se muestra.</p>
          <ul>
            <li className="flex items-center gap-2 border-t border-border py-1">
              <span className="grid size-11 shrink-0 place-items-center text-muted-foreground"><Lock className="size-4" aria-hidden="true" /></span>
              <span className="flex-1 py-2">Encabezado <span className="sr-only">(siempre va primero)</span></span>
            </li>
            <DndContext id="secciones" sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar} accessibility={ACCESIBILIDAD}>
              <SortableContext items={secciones.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {secciones.map((s) => (
                  <Fila
                    key={s.id}
                    seccion={s}
                    onToggle={() => setSecciones(secciones.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)))}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ul>
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setApariencia(aparienciaPorDefecto())}>
              <RotateCcw className="size-4" aria-hidden="true" />Restablecer todo
            </Button>
            <Button type="button" onClick={guardar} disabled={guardando || sinCambios}>
              {guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <VistaPrevia slug={slug} apariencia={apariencia} />
    </div>
  );
}
