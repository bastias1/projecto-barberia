"use client";

import { Label } from "@/components/ui/label";
import { Opcion } from "@/components/dashboard/apariencia-opcion";
import { ImagenInput } from "@/components/dashboard/imagen-input";
import { DISENOS, ENCUADRE, ENCUADRE_POR_DEFECTO, type Apariencia, type Encuadre } from "@/lib/apariencia";

export function AparienciaDiseno({ idBarberia, apariencia, onChange }: {
  idBarberia: string;
  apariencia: Apariencia;
  onChange: (apariencia: Apariencia) => void;
}) {
  const mover = (campo: keyof Encuadre, valor: number) => {
    const encuadre = { ...apariencia.encuadre, [campo]: valor };
    // En computador la foto entra justa a lo ancho: sin acercarla no hay hacia dónde moverla
    if (campo === "x") encuadre.zoom = Math.max(encuadre.zoom, 125);
    onChange({ ...apariencia, encuadre });
  };

  return (
    <div className="space-y-6">
      <Opcion campo="diseno" etiqueta="Diseño del inicio" opciones={DISENOS} valor={apariencia.diseno} onChange={(v) => onChange({ ...apariencia, diseno: v as Apariencia["diseno"] })} />
      {apariencia.diseno === "portada" && (
        <ImagenInput
          carpeta="portada"
          vacio="Sin foto"
          label="Foto de portada"
          descripcion="Queda de fondo detrás del nombre y se funde con la página. Horizontal, de hasta 5 MB; sin foto se ve como el Clásico."
          value={apariencia.portada}
          // una foto nueva parte centrada
          onChange={(portada) => onChange({ ...apariencia, portada, encuadre: { ...ENCUADRE_POR_DEFECTO } })}
          idBarberia={idBarberia}
          fondo="oscuro"
        />
      )}
      {apariencia.diseno === "portada" && apariencia.portada && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Posición de la foto</legend>
          {(Object.keys(ENCUADRE) as (keyof Encuadre)[]).map((campo) => (
            <div key={campo} className="grid grid-cols-[6rem_1fr] items-center gap-3">
              <Label htmlFor={`encuadre-${campo}`} className="font-normal">{ENCUADRE[campo].nombre}</Label>
              <input
                id={`encuadre-${campo}`}
                type="range"
                min={ENCUADRE[campo].min}
                max={ENCUADRE[campo].max}
                value={apariencia.encuadre[campo]}
                onChange={(e) => mover(campo, Number(e.target.value))}
                className="h-11 w-full accent-primary"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Al mover en horizontal la foto se acerca un poco para tener espacio.</p>
        </fieldset>
      )}
      {apariencia.diseno === "columna" && (
        <p className="text-xs text-muted-foreground">Las dos columnas se ven en computador; en el teléfono la página queda como el Clásico.</p>
      )}
    </div>
  );
}
