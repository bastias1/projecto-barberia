"use client"

// Filtros de las tablas del panel, según el "faceted filter" de los ejemplos de data table de shadcn.
// El estado vive en la URL: el Server Component filtra con los mismos parámetros.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarIcon, Check, CirclePlus, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatFecha, localDateString } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Cambia parámetros de la URL y vuelve a la primera página. `null` borra el parámetro. */
function useParametros() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  return {
    searchParams,
    cambiar(cambios: Record<string, string | null>) {
      const params = new URLSearchParams(searchParams);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) params.set(clave, valor);
        else params.delete(clave);
      }
      params.delete("pagina");
      const qs = params.toString();
      replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
  };
}

export interface OpcionFiltro {
  valor: string;
  label: string;
  cantidad?: number;
}

/** Selección múltiple: `?param=a,b`. */
export function FiltroFacetado({ param, titulo, opciones }: { param: string; titulo: string; opciones: OpcionFiltro[] }) {
  const { searchParams, cambiar } = useParametros();
  const elegidos = new Set(searchParams.get(param)?.split(",").filter(Boolean) ?? []);
  const alternar = (valor: string) => {
    const nuevos = new Set(elegidos);
    if (nuevos.has(valor)) nuevos.delete(valor);
    else nuevos.add(valor);
    cambiar({ [param]: [...nuevos].join(",") || null });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <CirclePlus aria-hidden="true" />
          {titulo}
          {elegidos.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">{elegidos.size}</Badge>
              <div className="hidden gap-1 lg:flex">
                {elegidos.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">{elegidos.size} elegidos</Badge>
                ) : (
                  opciones.filter((o) => elegidos.has(o.valor)).map((o) => (
                    <Badge key={o.valor} variant="secondary" className="rounded-sm px-1 font-normal">{o.label}</Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={titulo} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => {
                const elegido = elegidos.has(o.valor);
                return (
                  <CommandItem key={o.valor} value={o.label} onSelect={() => alternar(o.valor)}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border border-primary",
                        elegido ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-3.5 text-primary-foreground" />
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {o.cantidad !== undefined && <span className="font-mono text-xs text-muted-foreground">{o.cantidad}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {elegidos.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => cambiar({ [param]: null })} className="justify-center text-center">
                    Quitar filtro
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Rango de fechas: `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. */
export function FiltroFechas({ titulo, desde = "desde", hasta = "hasta" }: { titulo: string; desde?: string; hasta?: string }) {
  const { searchParams, cambiar } = useParametros();
  const d = searchParams.get(desde);
  const h = searchParams.get(hasta);
  const aFecha = (s: string | null) => (s ? new Date(`${s}T12:00:00`) : undefined);
  const [rango, setRango] = useState<DateRange | undefined>({ from: aFecha(d), to: aFecha(h) });

  const texto = d && h ? `${formatFecha(d, "d MMM")} – ${formatFecha(h, "d MMM yyyy")}` : d ? `Desde ${formatFecha(d, "d MMM yyyy")}` : h ? `Hasta ${formatFecha(h, "d MMM yyyy")}` : null;

  return (
    <Popover onOpenChange={(abierto) => abierto && setRango({ from: aFecha(d), to: aFecha(h) })}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9", !texto && "border-dashed")}>
          <CalendarIcon aria-hidden="true" />
          {titulo}
          {texto && (
            <>
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">{texto}</Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={rango}
          onSelect={(r) => {
            setRango(r);
            cambiar({ [desde]: r?.from ? localDateString(r.from) : null, [hasta]: r?.to ? localDateString(r.to) : null });
          }}
          defaultMonth={rango?.from}
          numberOfMonths={1}
          locale={es}
          weekStartsOn={1}
        />
        {texto && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setRango(undefined); cambiar({ [desde]: null, [hasta]: null }); }}>
              Quitar fechas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Botón "Limpiar" que borra los parámetros dados; no se muestra si ninguno está puesto. */
export function LimpiarFiltros({ params }: { params: string[] }) {
  const { searchParams, cambiar } = useParametros();
  if (!params.some((p) => searchParams.get(p))) return null;
  return (
    <Button variant="ghost" size="sm" className="h-9" onClick={() => cambiar(Object.fromEntries(params.map((p) => [p, null])))}>
      Limpiar
      <X aria-hidden="true" />
    </Button>
  );
}

/** Encabezado de columna ordenable: `?orden=campo&dir=asc|desc`. Tercer clic quita el orden. */
export function EncabezadoOrden({ campo, children, className }: { campo: string; children: React.ReactNode; className?: string }) {
  const { searchParams, cambiar } = useParametros();
  const activo = searchParams.get("orden") === campo;
  const dir = activo ? searchParams.get("dir") : null;
  const siguiente = !activo ? "asc" : dir === "asc" ? "desc" : null;
  const Icono = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[activo=true]:text-foreground", className)}
      data-activo={activo}
      aria-label={`Ordenar por ${typeof children === "string" ? children : campo}`}
      onClick={() => cambiar({ orden: siguiente ? campo : null, dir: siguiente })}
    >
      {children}
      <Icono className={cn("size-3.5", !activo && "opacity-50")} aria-hidden="true" />
    </Button>
  );
}
