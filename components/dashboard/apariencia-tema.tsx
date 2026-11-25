"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Opcion } from "@/components/dashboard/apariencia-opcion";
import { COLORES, MODOS, OPCIONES, PRESETS, type Tema } from "@/lib/apariencia";
import { ACENTO, BASE } from "@/lib/apariencia-css";

const ETIQUETAS: Record<keyof typeof OPCIONES, string> = {
  fuente: "Fuente",
  titulos: "Títulos",
  radio: "Esquinas",
  borde: "Borde",
  grosor: "Grosor del borde",
  sombra: "Sombra",
  hover: "Al pasar el cursor",
  superficie: "Superficie",
  patron: "Fondo de la página",
};

function Color({ campo, etiqueta, valor, referencia, delgado, onChange }: {
  campo: string;
  etiqueta: string;
  valor: string | null;
  /** Color que se muestra mientras no hay uno propio. */
  referencia: string;
  delgado?: boolean;
  onChange: (valor: string | null) => void;
}) {
  const color = valor ?? referencia;

  return (
    <div className="flex items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={`tema-${campo}`}
            className={`${delgado ? "h-7 w-10" : "h-11 w-14"} shrink-0 cursor-pointer rounded-md border border-input`}
            style={{ background: color }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto space-y-3">
          <HexColorPicker color={color} onChange={onChange} />
          <Label htmlFor={`tema-${campo}-hex`} className="sr-only">{etiqueta} en hexadecimal</Label>
          <HexColorInput
            id={`tema-${campo}-hex`}
            color={color}
            // solo colores completos: los de 3 dígitos no se guardan
            onChange={(v) => v.length === 7 && onChange(v)}
            prefixed
            className="h-9 w-[200px] rounded-md border border-input bg-transparent px-3 font-mono text-sm uppercase"
          />
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={!valor} onClick={() => onChange(null)}>
            Restablecer
          </Button>
        </PopoverContent>
      </Popover>
      <Label htmlFor={`tema-${campo}`} className="flex-1">{etiqueta}</Label>
      {!valor && <span className="text-xs text-muted-foreground">Por defecto</span>}
    </div>
  );
}

export function AparienciaTema({ tema, onChange }: { tema: Tema; onChange: (tema: Tema) => void }) {
  const cambiar = (campo: keyof Tema, valor: string | null) => onChange({ ...tema, [campo]: valor } as Tema);
  // En automático los colores de página y tarjeta no se aplican
  const colores = (Object.keys(COLORES) as (keyof typeof COLORES)[]).filter((c) => c !== "colorSombra" && (c === "acento" || tema.modo !== "auto"));

  return (
    <div className="space-y-6" style={{ ...(tema.acento && { "--brand": tema.acento }), ...(tema.colorSombra && { "--sombra": tema.colorSombra }) } as React.CSSProperties}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Estilos listos</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.nombre} type="button" variant="outline" size="sm" onClick={() => onChange({ ...p.tema })}>
              <span aria-hidden="true" className="size-3 rounded-full border border-border" style={{ background: p.tema.acento ?? "var(--brand)" }} />
              {p.nombre}
            </Button>
          ))}
        </div>
      </fieldset>

      <Opcion campo="modo" etiqueta="Modo" opciones={MODOS} valor={tema.modo} onChange={(v) => cambiar("modo", v)} />

      <div className="space-y-3">
        {colores.map((campo) => (
          <Color
            key={campo}
            campo={campo}
            etiqueta={COLORES[campo]}
            valor={tema[campo]}
            referencia={campo === "acento" ? ACENTO : BASE[tema.modo === "oscuro" ? "oscuro" : "claro"].fondo}
            onChange={(v) => cambiar(campo, v)}
          />
        ))}
        {tema.modo === "auto" && (
          <p className="text-xs text-muted-foreground">Elige el modo Claro u Oscuro para cambiar los colores de la página y las tarjetas.</p>
        )}
      </div>

      <div className="space-y-6">
        {(Object.keys(OPCIONES) as (keyof typeof OPCIONES)[]).map((campo) => (
          <div key={campo} className="space-y-2">
            <Opcion campo={campo} etiqueta={ETIQUETAS[campo]} opciones={OPCIONES[campo]} valor={tema[campo]} onChange={(v) => cambiar(campo, v)} />
            {campo === "sombra" && (
              <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                <Color delgado campo="colorSombra" etiqueta={COLORES.colorSombra} valor={tema.colorSombra} referencia={tema.acento ?? ACENTO} onChange={(v) => cambiar("colorSombra", v)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
