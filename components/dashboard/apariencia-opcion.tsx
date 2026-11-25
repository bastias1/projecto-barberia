"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FAMILIAS } from "@/components/apariencia-provider";
import { OPCIONES, type Tema } from "@/lib/apariencia";
import { BASE, GROSORES, PATRONES, RADIOS, SOMBRAS } from "@/lib/apariencia-css";

const CAJA = "h-8 w-12 border border-foreground/40 bg-card";
// Versión exagerada de los efectos de cssTema, para que se noten en una miniatura
const EFECTOS: Record<Tema["hover"], string> = {
  ninguno: "",
  elevar: "motion-safe:group-hover:-translate-y-1.5",
  brillo: "group-hover:shadow-[0_0_18px_-2px_var(--brand)]",
  presionar: "motion-safe:group-hover:translate-x-1 motion-safe:group-hover:translate-y-1",
};

/** Dibujo de cómo se ve una opción. Es decorativo: el nombre va escrito debajo. */
type Campo = keyof typeof OPCIONES | "modo" | "diseno";

function Miniatura({ campo, valor }: { campo: Campo; valor: string }) {
  switch (campo) {
    case "diseno": {
      const bloque = "rounded-sm bg-foreground/30";
      if (valor === "columna") {
        return (
          <span className="flex h-8 w-12 gap-1">
            <span className={`${bloque} w-4`} />
            <span className="flex flex-1 flex-col gap-1"><span className={`${bloque} flex-1`} /><span className={`${bloque} flex-1`} /></span>
          </span>
        );
      }
      if (valor === "portada") {
        return (
          <span className="flex h-8 w-12 flex-col justify-center gap-1 rounded-sm bg-linear-to-r from-transparent from-35% to-brand px-1">
            <span className={`${bloque} h-1.5 w-5`} />
            <span className={`${bloque} h-1.5 w-4`} />
          </span>
        );
      }
      return (
        <span className="flex h-8 w-12 flex-col gap-1">
          <span className={`${bloque} flex-1`} />
          <span className={`${bloque} flex-1`} />
        </span>
      );
    }
    case "modo": {
      const fondo = {
        auto: `linear-gradient(115deg,${BASE.claro.fondo} 50%,${BASE.oscuro.fondo} 50%)`,
        claro: BASE.claro.fondo,
        oscuro: BASE.oscuro.fondo,
      }[valor as Tema["modo"]];
      return <span className={`${CAJA} rounded-md`} style={{ background: fondo }} />;
    }
    case "fuente":
      return <span className="text-2xl leading-8" style={{ fontFamily: FAMILIAS[valor as Tema["fuente"]] ?? "var(--font-geist-sans)" }}>Aa</span>;
    case "titulos":
      return <span className="text-2xl font-semibold leading-8">{{ normal: "Aa", mayusculas: "AA", minusculas: "aa" }[valor as Tema["titulos"]]}</span>;
    case "radio":
      return <span className={CAJA} style={{ borderRadius: RADIOS[valor as Tema["radio"]]?.[0] ?? "1rem" }} />;
    case "borde":
      return <span className={`${CAJA} rounded-md`} style={{ borderStyle: valor === "discontinuo" ? "dashed" : "solid", borderWidth: valor === "ninguno" ? 0 : 2 }} />;
    case "grosor":
      return <span className={`${CAJA} rounded-md`} style={{ borderWidth: GROSORES[valor as Tema["grosor"]] }} />;
    case "sombra":
      return <span className={`${CAJA} rounded-md`} style={{ boxShadow: SOMBRAS[valor as Tema["sombra"]] ?? undefined }} />;
    case "hover":
      return <span className={`${CAJA} rounded-md transition-all ${EFECTOS[valor as Tema["hover"]]}`} />;
    case "superficie":
      return (
        <span className="grid h-8 w-12 place-items-center rounded-md bg-[repeating-linear-gradient(45deg,var(--brand)_0_4px,transparent_4px_9px)]">
          <span className={`h-5 w-8 rounded border border-foreground/40 ${valor === "vidrio" ? "bg-card/60 backdrop-blur-[2px]" : "bg-card"}`} />
        </span>
      );
    case "patron": {
      const patron = PATRONES[valor as Tema["patron"]];
      return <span className="h-8 w-12 rounded-md border border-foreground/40" style={patron ? { ...patron, ...(valor !== "degradado" && { backgroundSize: "8px 8px" }) } : undefined} />;
    }
  }
}

export function Opcion({ campo, etiqueta, opciones, valor, onChange }: {
  campo: Campo;
  etiqueta: string;
  opciones: Record<string, string>;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p id={`tema-${campo}`} className="text-sm font-medium">{etiqueta}</p>
      <RadioGroup value={valor} onValueChange={onChange} aria-labelledby={`tema-${campo}`} className="grid-cols-3 gap-2">
        {Object.entries(opciones).map(([clave, texto]) => (
          <div key={clave}>
            <RadioGroupItem id={`tema-${campo}-${clave}`} value={clave} className="peer sr-only" />
            <Label
              htmlFor={`tema-${campo}-${clave}`}
              className="group flex h-full cursor-pointer flex-col items-center justify-start gap-2 rounded-lg border border-border bg-muted/40 px-1 py-3 text-center text-xs font-normal leading-tight hover:bg-muted peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent"
            >
              <span aria-hidden="true" className="grid h-9 place-items-center">
                <Miniatura campo={campo} valor={clave} />
              </span>
              {texto}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
