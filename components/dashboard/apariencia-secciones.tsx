"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SECCION_NOMBRE, type SeccionConfig, type SeccionId } from "@/lib/apariencia";
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

export function AparienciaSecciones({ secciones, onChange }: { secciones: SeccionConfig[]; onChange: (secciones: SeccionConfig[]) => void }) {
  const sensores = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const desde = secciones.findIndex((s) => s.id === active.id);
    const hasta = secciones.findIndex((s) => s.id === over.id);
    onChange(arrayMove(secciones, desde, hasta));
  };

  return (
    <>
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
                onToggle={() => onChange(secciones.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)))}
              />
            ))}
          </SortableContext>
        </DndContext>
      </ul>
    </>
  );
}
