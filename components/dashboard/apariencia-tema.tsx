"use client";

import { HexColorInput, HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FAMILIAS } from "@/components/apariencia-provider";
import { COLORES, DISENOS, ENCUADRE, ENCUADRE_POR_DEFECTO, MODOS, OPCIONES, PRESETS, type Apariencia, type Encuadre, type Tema } from "@/lib/apariencia";
import { LogoInput } from "@/components/dashboard/barberia-form";
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
type Campo = keyof typeof OPCIONES | "modo" | "diseno";

function Muestra({ campo, valor }: { campo: Campo; valor: string }) {
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
        <LogoInput
          carpeta="portada"
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
          <div key={campo} className="space-y-2">
            <Opcion campo={campo} etiqueta={ETIQUETAS[campo]} opciones={OPCIONES[campo]} valor={tema[campo]} onChange={(v) => cambiar(campo, v)} />
            {campo === "sombra" && (
              <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                <Color delgado campo="colorSombra" etiqueta={COLORES.colorSombra} valor={tema.colorSombra} referencia={tema.acento ?? "#a1ffcb"} onChange={(v) => cambiar("colorSombra", v)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
