"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cargarGrafico } from "@/app/[slug]/dashboard/estadisticas/actions";
import type { DatosBI, FiltrosBI, OpcionesFiltro, Rango } from "@/lib/services/bi-service";
import {
  COLOR_PRODUCTOS, COLOR_SERVICIOS, DemandaChart, IngresosChart, OcupacionChart, RankingChart, ResumenMensualTabla,
} from "./bi-charts";

/**
 * Cada gráfico lleva sus propios filtros: al cambiarlos recalcula solo ese gráfico (server action)
 * con el rango de la página. La página los remonta con `key` cuando cambia el rango, y así se reinician.
 */

interface PanelProps<K extends keyof DatosBI> {
  slug: string;
  rango: Rango;
  inicial: DatosBI[K];
  opciones: OpcionesFiltro;
  /** Un profesional no filtra por profesional ni por tipo: solo ve lo suyo y sin productos. */
  esAdmin: boolean;
}

function useGrafico<K extends keyof DatosBI>(grafico: K, { slug, rango, inicial }: PanelProps<K>) {
  const [filtros, setFiltros] = useState<FiltrosBI>({});
  const [datos, setDatos] = useState<DatosBI[K]>(inicial);
  const [error, setError] = useState(false);
  const [cargando, iniciar] = useTransition();
  const ultima = useRef(0);

  const cambiar = (nuevo: FiltrosBI) => {
    setFiltros(nuevo);
    const n = ++ultima.current;
    iniciar(async () => {
      const r = await cargarGrafico(slug, grafico, rango, nuevo);
      if (n !== ultima.current) return; // llegó tarde: ya hay otra consulta más nueva
      if (r.ok) setDatos(r.datos);
      setError(!r.ok);
    });
  };

  return { filtros, datos, error, cargando, cambiar };
}

type Campo = "tipo" | "sucursal" | "profesional" | "servicio";

function BarraFiltros({ g, campos: todos, opciones, nota, esAdmin }: {
  g: { filtros: FiltrosBI; error: boolean; cambiar: (f: FiltrosBI) => void };
  campos: Campo[];
  opciones: OpcionesFiltro;
  nota?: string;
  esAdmin: boolean;
}) {
  const id = useId();
  const campos = todos.filter((c) => esAdmin || (c !== "profesional" && c !== "tipo"));
  const lista: Record<Campo, { label: string; todos: string; items: { valor: string; texto: string }[] }> = {
    tipo: { label: "Tipo", todos: "Todos", items: [{ valor: "servicios", texto: "Servicios" }, { valor: "productos", texto: "Productos" }] },
    sucursal: { label: "Sucursal", todos: "Todas", items: opciones.sucursales.map((s) => ({ valor: String(s.id), texto: s.nombre })) },
    profesional: { label: "Profesional", todos: "Todos", items: opciones.profesionales.map((p) => ({ valor: p.id, texto: p.nombre })) },
    servicio: { label: "Servicio", todos: "Todos", items: opciones.servicios.map((s) => ({ valor: String(s.id), texto: s.nombre })) },
  };

  const poner = (campo: Campo, valor: string) => {
    const nuevo = { ...g.filtros };
    if (!valor) delete nuevo[campo];
    else if (campo === "tipo") nuevo.tipo = valor as FiltrosBI["tipo"];
    else if (campo === "profesional") nuevo.profesional = valor;
    else nuevo[campo] = Number(valor);
    g.cambiar(nuevo);
  };
  const valorActual = (campo: Campo) => String(g.filtros[campo] ?? "");
  const hayFiltros = campos.some((c) => g.filtros[c] !== undefined);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        {campos.map((c) => (
          <div key={c} className="min-w-0 space-y-1 sm:w-44">
            <Label htmlFor={`${id}-${c}`} className="text-xs text-muted-foreground">{lista[c].label}</Label>
            <select
              id={`${id}-${c}`}
              value={valorActual(c)}
              onChange={(e) => poner(c, e.target.value)}
              className="h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9"
            >
              <option value="" className="bg-background">{lista[c].todos}</option>
              {lista[c].items.map((i) => <option key={i.valor} value={i.valor} className="bg-background">{i.texto}</option>)}
            </select>
          </div>
        ))}
        {hayFiltros && (
          <Button type="button" variant="ghost" size="sm" className="col-span-2 h-11 sm:col-span-1 sm:h-9" onClick={() => g.cambiar({})}>
            Limpiar filtros
          </Button>
        )}
      </div>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      {g.error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">No se pudo actualizar este gráfico. Intenta de nuevo.</p>}
    </div>
  );
}

export function IngresosPanel(props: PanelProps<"ingresos">) {
  const g = useGrafico("ingresos", props);
  const nota = g.filtros.profesional || g.filtros.servicio
    ? "Con profesional o servicio solo se cuentan servicios: los productos no tienen ninguno de los dos."
    : undefined;
  return (
    <IngresosChart
      datos={g.datos} gran={props.rango.gran} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["tipo", "sucursal", "profesional", "servicio"]} opciones={props.opciones} nota={nota} esAdmin={props.esAdmin} />}
    />
  );
}

export function ServiciosPanel(props: PanelProps<"servicios">) {
  const g = useGrafico("servicios", props);
  return (
    <RankingChart
      titulo="Servicios más realizados" descripcion="Citas completadas" unidad="Citas" color={COLOR_SERVICIOS}
      datos={g.datos} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["sucursal", "profesional"]} opciones={props.opciones} esAdmin={props.esAdmin} />}
    />
  );
}

export function ProductosPanel(props: PanelProps<"productos">) {
  const g = useGrafico("productos", props);
  const nota = g.filtros.sucursal ? "Los pedidos sin sucursal no se incluyen." : undefined;
  return (
    <RankingChart
      titulo="Productos más vendidos" descripcion="Unidades en pedidos pagados" unidad="Unidades" color={COLOR_PRODUCTOS}
      datos={g.datos} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["sucursal"]} opciones={props.opciones} nota={nota} esAdmin={props.esAdmin} />}
    />
  );
}

export function DemandaPanel(props: PanelProps<"demanda">) {
  const g = useGrafico("demanda", props);
  return (
    <DemandaChart
      datos={g.datos} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["sucursal", "profesional", "servicio"]} opciones={props.opciones} esAdmin={props.esAdmin} />}
    />
  );
}

export function OcupacionPanel(props: PanelProps<"ocupacion">) {
  const g = useGrafico("ocupacion", props);
  return (
    <OcupacionChart
      datos={g.datos} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["sucursal", "profesional"]} opciones={props.opciones} esAdmin={props.esAdmin} />}
    />
  );
}

export function ResumenPanel(props: PanelProps<"resumen">) {
  const g = useGrafico("resumen", props);
  return (
    <ResumenMensualTabla
      datos={g.datos} cargando={g.cargando}
      filtros={<BarraFiltros g={g} campos={["sucursal", "profesional", "servicio"]} opciones={props.opciones} esAdmin={props.esAdmin} />}
    />
  );
}
