"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FAMILIAS } from "@/components/apariencia-provider";
import { COLORES, MODOS, OPCIONES, PRESETS, type Tema } from "@/lib/apariencia";
import { GROSORES, PATRONES, RADIOS, SOMBRAS } from "@/lib/apariencia-css";

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

/** "a:b;c:d" (como lo escribe cssTema) -> estilo de React. */
const estilo = (css: string) =>
  Object.fromEntries(css.split(";").map((d) => {
    const i = d.indexOf(":");
    return [d.slice(0, i).replace(/-(\w)/g, (_, c: string) => c.toUpperCase()), d.slice(i + 1)];
  })) as React.CSSProperties;

const CAJA = "h-8 w-12 border border-foreground/40 bg-card";
const EFECTOS: Record<Tema["hover"], string> = {
  ninguno: "",
  elevar: "motion-safe:group-hover:-translate-y-1.5",
  brillo: "group-hover:shadow-[0_0_18px_-2px_var(--brand)]",
  presionar: "motion-safe:group-hover:translate-x-1 motion-safe:group-hover:translate-y-1",
};

/** Dibujo de cómo se ve una opción. Es decorativo: el nombre va escrito debajo. */
function Muestra({ campo, valor }: { campo: keyof typeof OPCIONES | "modo"; valor: string }) {
  switch (campo) {
    case "modo": {
      const fondo = { auto: "linear-gradient(115deg,#fff 50%,#0d0e0e 50%)", claro: "#fff", oscuro: "#0d0e0e" }[valor as Tema["modo"]];
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
      return <span className="h-8 w-12 rounded-md border border-foreground/40" style={patron ? { ...estilo(patron), ...(valor !== "degradado" && { backgroundSize: "8px 8px" }) } : undefined} />;
    }
  }
}

function Opcion({ campo, etiqueta, opciones, valor, onChange }: {
  campo: keyof typeof OPCIONES | "modo";
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
                <Muestra campo={campo} valor={clave} />
              </span>
              {texto}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function Color({ campo, etiqueta, valor, referencia, onChange }: {
  campo: string;
  etiqueta: string;
  valor: string | null;
  /** Color que se muestra mientras no hay uno propio. */
  referencia: string;
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
            className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input"
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
        </PopoverContent>
      </Popover>
      <Label htmlFor={`tema-${campo}`} className="flex-1">{etiqueta}</Label>
      {valor ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`Quitar ${etiqueta.toLowerCase()}`}>
          Quitar
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Por defecto</span>
      )}
    </div>
  );
}

export function AparienciaTema({ tema, onChange }: { tema: Tema; onChange: (tema: Tema) => void }) {
  const cambiar = (campo: keyof Tema, valor: string | null) => onChange({ ...tema, [campo]: valor } as Tema);
  // En automático los colores de página y tarjeta no se aplican
  const colores = (Object.keys(COLORES) as (keyof typeof COLORES)[]).filter((c) => c === "acento" || tema.modo !== "auto");

  return (
    <div className="space-y-6" style={tema.acento ? ({ "--brand": tema.acento } as React.CSSProperties) : undefined}>
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
            referencia={campo === "acento" ? "#a1ffcb" : tema.modo === "oscuro" ? "#0d0e0e" : "#ffffff"}
            onChange={(v) => cambiar(campo, v)}
          />
        ))}
        {tema.modo === "auto" && (
          <p className="text-xs text-muted-foreground">Elige el modo Claro u Oscuro para cambiar los colores de la página y las tarjetas.</p>
        )}
      </div>

      <div className="space-y-6">
        {(Object.keys(OPCIONES) as (keyof typeof OPCIONES)[]).map((campo) => (
          <Opcion key={campo} campo={campo} etiqueta={ETIQUETAS[campo]} opciones={OPCIONES[campo]} valor={tema[campo]} onChange={(v) => cambiar(campo, v)} />
        ))}
      </div>
    </div>
  );
}
