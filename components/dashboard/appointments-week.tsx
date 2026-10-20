"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import type { Appointment } from "@/lib/services/dashboard-service";
import { localDateString, toZoned } from "@/lib/datetime";
import { DEFAULT_TZ } from "@/lib/barberia";
import { cn } from "@/lib/utils";

interface AppointmentsWeekProps {
  porDia: Map<string, Appointment[]>;
  hoy: Date;
  selected: Date;
  onSelect: (date: Date) => void;
}

// Color de cada cita en la tabla según su estado
const ESTADO_CHIP: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  confirmada: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800",
  completada: "bg-green-100 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800",
  no_asistio: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
  cancelada: "bg-zinc-100 text-zinc-500 border-zinc-200 line-through dark:bg-zinc-800/50 dark:text-zinc-500 dark:border-zinc-700",
};

const contarActivas = (lista: Appointment[]) => lista.filter((a) => a.estado !== "cancelada").length;
const textoCitas = (n: number) => (n === 0 ? "Sin citas" : `${n} ${n === 1 ? "cita" : "citas"}`);

/** Vista semanal: tabla días × horas en escritorio; un día por slide en móvil. */
export function AppointmentsWeek({ porDia, hoy, selected, onSelect }: AppointmentsWeekProps) {
  const inicioSemana = startOfWeek(selected, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));
  const [detalleId, setDetalleId] = useState<number | null>(null);

  // La cita del detalle se toma de las props: tras Completar/Ausente llega actualizada
  const detalle = useMemo(() => {
    for (const lista of porDia.values()) {
      const apt = lista.find((a) => a.id === detalleId);
      if (apt) return apt;
    }
    return null;
  }, [porDia, detalleId]);

  const cambiarSemana = (semanas: number) => onSelect(addDays(selected, semanas * 7));
  const rango = `${format(dias[0], "d MMM", { locale: es })} – ${format(dias[6], "d MMM yyyy", { locale: es })}`;

  return (
    <div className="space-y-4">
      {/* Navegación de semanas */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => cambiarSemana(-1)} aria-label="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-semibold capitalize text-center">{rango}</p>
        <Button variant="outline" size="icon" onClick={() => cambiarSemana(1)} aria-label="Semana siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden md:block">
        <SemanaTabla dias={dias} porDia={porDia} hoy={hoy} onAbrir={setDetalleId} />
      </div>
      <div className="md:hidden">
        <SemanaDeslizable dias={dias} porDia={porDia} hoy={hoy} selected={selected} onSelect={onSelect} />
      </div>

      {/* Detalle de una cita de la tabla, con sus acciones */}
      <Dialog open={detalle !== null} onOpenChange={(open) => !open && setDetalleId(null)}>
        <DialogContent>
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">
                  {format(new Date(`${detalle.fecha}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })} · {detalle.hora}
                </DialogTitle>
                <DialogDescription>{detalle.servicio?.nombre ?? "Sin servicio"}</DialogDescription>
              </DialogHeader>
              <AppointmentCard appointment={detalle} />
              <div className="space-y-1 text-sm text-muted-foreground">
                {detalle.cliente?.telefono && (
                  <a href={`tel:${detalle.cliente.telefono.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {detalle.cliente.telefono}
                  </a>
                )}
                {detalle.cliente?.correo && (
                  <a href={`mailto:${detalle.cliente.correo}`} className="flex items-center gap-2 hover:text-foreground break-all">
                    <Mail className="h-3.5 w-3.5" />
                    {detalle.cliente.correo}
                  </a>
                )}
                {detalle.notas && <p className="pt-2 text-foreground">Nota: {detalle.notas}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Escritorio: tabla con una columna por día y una fila por hora. */
function SemanaTabla({
  dias,
  porDia,
  hoy,
  onAbrir,
}: {
  dias: Date[];
  porDia: Map<string, Appointment[]>;
  hoy: Date;
  onAbrir: (id: number) => void;
}) {
  const citasSemana = dias.flatMap((d) => porDia.get(localDateString(d)) ?? []);
  // Horas a mostrar: 09–19 como base, ampliadas si hay citas fuera de ese rango
  const horasCitas = citasSemana.map((a) => Number(a.hora.slice(0, 2)));
  const desde = Math.min(9, ...horasCitas);
  const hasta = Math.max(19, ...horasCitas);
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  // Hora actual de la barbería; se calcula en el navegador (evita diferencias al hidratar)
  const [ahora, setAhora] = useState<{ fecha: string; hora: number; minuto: number } | null>(null);
  useEffect(() => {
    const actualizar = () => {
      const { fecha, hora } = toZoned(new Date(), DEFAULT_TZ);
      setAhora({ fecha, hora: Number(hora.slice(0, 2)), minuto: Number(hora.slice(3, 5)) });
    };
    actualizar();
    const id = setInterval(actualizar, 60_000);
    return () => clearInterval(id);
  }, []);
  const semanaConHoy = ahora !== null && dias.some((d) => localDateString(d) === ahora.fecha);

  // Al abrir, llevar la vista a la hora actual (solo la primera vez)
  const filaAhora = useRef<HTMLTableRowElement>(null);
  const yaCentrada = useRef(false);
  useEffect(() => {
    if (semanaConHoy && filaAhora.current && !yaCentrada.current) {
      yaCentrada.current = true;
      filaAhora.current.scrollIntoView({ block: "center" });
    }
  }, [semanaConHoy]);

  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-16 p-2" />
              {dias.map((dia) => {
                const lista = porDia.get(localDateString(dia)) ?? [];
                const esHoy = isSameDay(dia, hoy);
                return (
                  <th key={dia.toISOString()} className={cn("p-2 font-medium border-l", esHoy && "bg-primary/5")}>
                    <div className="text-xs uppercase text-muted-foreground">{format(dia, "EEE", { locale: es })}</div>
                    <div className={cn(
                      "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base",
                      esHoy && "bg-primary text-primary-foreground"
                    )}>
                      {format(dia, "d")}
                    </div>
                    <div className="text-[11px] font-normal text-muted-foreground mt-1">{textoCitas(contarActivas(lista))}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {horas.map((h) => {
              const esHoraActual = semanaConHoy && ahora?.hora === h;
              return (
              <tr key={h} ref={esHoraActual ? filaAhora : undefined} className={cn("border-b last:border-b-0", esHoraActual && "bg-red-50/40 dark:bg-red-950/10")}>
                <td className={cn("p-2 align-top text-right text-xs whitespace-nowrap", esHoraActual ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground")}>
                  {String(h).padStart(2, "0")}:00
                </td>
                {dias.map((dia) => {
                  const citas = (porDia.get(localDateString(dia)) ?? []).filter((a) => Number(a.hora.slice(0, 2)) === h);
                  return (
                    <td
                      key={dia.toISOString()}
                      className={cn("relative border-l p-1 align-top h-14", isSameDay(dia, hoy) && "bg-primary/5")}
                    >
                      {/* Línea de "ahora" en la celda de hoy */}
                      {esHoraActual && ahora && localDateString(dia) === ahora.fecha && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                          style={{ top: `${(ahora.minuto / 60) * 100}%` }}
                          aria-label="Hora actual"
                        >
                          <span className="-ml-1 size-2 rounded-full bg-red-500" />
                          <span className="h-0.5 flex-1 bg-red-500" />
                        </div>
                      )}
                      <div className="space-y-1">
                        {citas.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => onAbrir(a.id)}
                            className={cn(
                              "w-full rounded-md border px-2 py-1 text-left text-xs transition-shadow hover:shadow-md",
                              ESTADO_CHIP[a.estado] ?? ESTADO_CHIP.pendiente
                            )}
                          >
                            <span className="font-semibold">{a.hora}</span>{" "}
                            <span className="truncate">{a.cliente?.nombre} {a.cliente?.apellido}</span>
                            <span className="block truncate opacity-80">{a.servicio?.nombre}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
        {[["Pendiente", "pendiente"], ["Confirmada", "confirmada"], ["Completada", "completada"], ["Ausente", "no_asistio"], ["Cancelada", "cancelada"]].map(([label, estado]) => (
          <span key={estado} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm border", ESTADO_CHIP[estado])} />
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** Móvil: la agenda de un día por slide; se desliza para cambiar de día. */
function SemanaDeslizable({
  dias,
  porDia,
  hoy,
  selected,
  onSelect,
}: {
  dias: Date[];
  porDia: Map<string, Appointment[]>;
  hoy: Date;
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const indice = Math.max(0, dias.findIndex((d) => isSameDay(d, selected)));
  const semana = localDateString(dias[0]);
  // Slides: domingo anterior + la semana + lunes siguiente. Llegar a uno de los
  // extremos elige ese día, que es de otra semana: el carrusel se vuelve a armar
  // en esa semana y se sigue deslizando sin cortes.
  const slides = [addDays(dias[0], -1), ...dias, addDays(dias[6], 1)];

  // Al cambiar de semana el carrusel se vuelve a montar: el api anterior queda desconectado
  const apiVigente = api && api.rootNode().isConnected ? api : undefined;

  // Deslizar cambia el día elegido
  useEffect(() => {
    const api = apiVigente;
    if (!api) return;
    const onSlide = () => onSelect(slides[api.selectedScrollSnap()]);
    api.on("select", onSlide);
    return () => {
      api.off("select", onSlide);
    };
  }, [apiVigente, slides, onSelect]);

  // Tocar un día de la tira lleva a su slide
  useEffect(() => {
    if (apiVigente && apiVigente.selectedScrollSnap() !== indice + 1) apiVigente.scrollTo(indice + 1);
  }, [apiVigente, indice]);

  return (
    <div className="space-y-3">
      {/* Tira de días de la semana */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia, i) => {
          const activas = contarActivas(porDia.get(localDateString(dia)) ?? []);
          const elegido = i === indice;
          return (
            <button
              key={dia.toISOString()}
              type="button"
              onClick={() => onSelect(dia)}
              className={cn(
                "flex flex-col items-center rounded-lg py-2 text-xs transition-colors",
                elegido ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                !elegido && isSameDay(dia, hoy) && "ring-1 ring-primary"
              )}
            >
              <span className="uppercase opacity-80">{format(dia, "EEEEE", { locale: es })}</span>
              <span className="text-base font-semibold">{format(dia, "d")}</span>
              <span className={cn(
                "mt-0.5 size-1.5 rounded-full",
                activas > 0 ? (elegido ? "bg-primary-foreground" : "bg-amber-500") : "bg-transparent"
              )} />
            </button>
          );
        })}
      </div>

      {/* Un slide por día; se reinicia al cambiar de semana */}
      <Carousel key={semana} opts={{ startIndex: indice + 1 }} setApi={setApi} aria-label="Agenda de la semana">
        <CarouselContent>
          {slides.map((dia) => {
            const lista = porDia.get(localDateString(dia)) ?? [];
            return (
              <CarouselItem key={dia.toISOString()}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold capitalize">{format(dia, "EEEE d 'de' MMMM", { locale: es })}</h3>
                      <span className="text-xs text-muted-foreground">{textoCitas(contarActivas(lista))}</span>
                    </div>
                    {lista.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <CalendarIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                        <p className="text-sm text-muted-foreground">No tienes citas este día</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {lista.map((a) => (
                          <AppointmentCard key={a.id} appointment={a} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      <p className="text-center text-xs text-muted-foreground">Desliza para cambiar de día (y de semana)</p>
    </div>
  );
}
