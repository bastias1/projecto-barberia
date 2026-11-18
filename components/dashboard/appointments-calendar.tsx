"use client"

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { AppointmentsWeek } from "@/components/dashboard/appointments-week";
import { NuevaCitaDialog } from "@/components/dashboard/nueva-cita-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Appointment } from "@/lib/services/dashboard-service";
import { DEFAULT_TZ, type Sucursal } from "@/lib/barberia";
import { localDateString, todayIn } from "@/lib/datetime";

export type Vista = "dia" | "semana" | "mes";

interface AppointmentsCalendarProps {
  appointments: Appointment[];
  // Desde la URL (?vista=&fecha=), validados en la página
  vistaInicial: Vista;
  fechaInicial: string | null;
  // Solo para quien tiene agenda propia: habilita "+ Nueva cita"
  nuevaCita: { barberoId: string; sucursales: Sucursal[] } | null;
}

// Estados que todavía requieren atención del barbero
const ACTIVAS = ["pendiente", "confirmada"];

// Punto bajo el número del día (se dibuja sobre la celda, sin tocar el botón)
const PUNTO = "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:content-['']";

/** "2026-10-20" -> Date local (medianoche) para el calendario. */
function toDate(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Agenda de citas con vista diaria, semanal (predeterminada) o mensual. */
export function AppointmentsCalendar({ appointments, vistaInicial, fechaInicial, nuevaCita }: AppointmentsCalendarProps) {
  // "Hoy" según la barbería, no según el reloj del navegador
  const hoy = useMemo(() => toDate(todayIn(DEFAULT_TZ)), []);
  const inicial = useMemo(() => (fechaInicial ? toDate(fechaInicial) : hoy), [fechaInicial, hoy]);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  // El día elegido se comparte entre vistas
  const [selected, setSelected] = useState<Date>(inicial);
  const [month, setMonth] = useState<Date>(inicial);

  // Citas agrupadas por día (YYYY-MM-DD) y ordenadas por hora
  const porDia = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments) {
      const lista = map.get(apt.fecha) ?? [];
      lista.push(apt);
      map.set(apt.fecha, lista);
    }
    for (const lista of map.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora));
    return map;
  }, [appointments]);

  const modifiers = useMemo(() => {
    const conPendientes: Date[] = [];
    const conCitas: Date[] = [];
    for (const [fecha, lista] of porDia) {
      (lista.some((a) => ACTIVAS.includes(a.estado)) ? conPendientes : conCitas).push(toDate(fecha));
    }
    return { conPendientes, conCitas };
  }, [porDia]);

  // Resumen del mes visible
  const prefijoMes = format(month, "yyyy-MM");
  const delMes = appointments.filter((a) => a.fecha.startsWith(prefijoMes) && a.estado !== "cancelada");
  const pendientesMes = delMes.filter((a) => ACTIVAS.includes(a.estado)).length;

  const delDia = porDia.get(localDateString(selected)) ?? [];
  const activasDia = delDia.filter((a) => a.estado !== "cancelada").length;

  const elegirDia = useCallback((date: Date) => {
    setSelected(date);
    setMonth(date);
  }, []);

  const irAHoy = useCallback(() => elegirDia(hoy), [elegirDia, hoy]);

  // Vista y día en la URL: recargar, volver atrás o compartir el link mantiene lo que se ve
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("vista", vista);
    url.searchParams.set("fecha", localDateString(selected));
    window.history.replaceState(window.history.state, "", url);
  }, [vista, selected]);

  // Atajos de teclado: ←/→ cambian de día, semana o mes según la vista y T vuelve a hoy
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const paso = e.key === "ArrowLeft" ? -1 : 1;
        e.preventDefault();
        if (vista === "dia") elegirDia(addDays(selected, paso));
        else if (vista === "semana") elegirDia(addDays(selected, paso * 7));
        else setMonth((m) => addMonths(m, paso));
      } else if (e.key === "t" || e.key === "T") {
        irAHoy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vista, selected, elegirDia, irAHoy]);

  // Citas del día elegido: es la vista "Día" (con flechas) y el panel de la vista "Mes"
  const agendaDia = (conFlechas: boolean) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        {conFlechas && (
          <Button variant="outline" size="icon" onClick={() => elegirDia(addDays(selected, -1))} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className={conFlechas ? "text-center" : undefined}>
          <CardTitle className="text-lg first-letter:uppercase">
            {format(selected, "EEEE d 'de' MMMM", { locale: es })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {activasDia === 0 ? "Sin citas" : `${activasDia} ${activasDia === 1 ? "cita" : "citas"}`}
          </p>
        </div>
        {conFlechas && (
          <Button variant="outline" size="icon" onClick={() => elegirDia(addDays(selected, 1))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {delDia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-sm text-muted-foreground">No tienes citas este día</p>
          </div>
        ) : (
          <div className="space-y-3">
            {delDia.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList>
            <TabsTrigger value="dia">Día</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <span className="hidden lg:inline text-xs text-muted-foreground mr-2">
            <kbd className="rounded border px-1">←</kbd> <kbd className="rounded border px-1">→</kbd> cambiar · <kbd className="rounded border px-1">T</kbd> hoy
          </span>
          <Button variant="outline" size="sm" onClick={irAHoy}>Hoy</Button>
          {nuevaCita && (
            <NuevaCitaDialog
              barberoId={nuevaCita.barberoId}
              sucursales={nuevaCita.sucursales}
              fechaInicial={selected}
              onCreada={elegirDia}
            />
          )}
        </div>
      </div>

      {vista === "dia" ? (
        agendaDia(true)
      ) : vista === "semana" ? (
        <AppointmentsWeek porDia={porDia} hoy={hoy} selected={selected} onSelect={elegirDia} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[auto_1fr] items-start">
          {/* Calendario */}
          <Card className="md:sticky md:top-0">
            <CardHeader className="pb-0">
              <p className="text-sm text-muted-foreground">
                {delMes.length} {delMes.length === 1 ? "cita" : "citas"} · {pendientesMes} por atender
              </p>
            </CardHeader>
            <CardContent className="px-2 sm:px-4">
              <Calendar
                mode="single"
                required
                selected={selected}
                onSelect={(date) => date && setSelected(date)}
                month={month}
                onMonthChange={setMonth}
                locale={es}
                weekStartsOn={1}
                modifiers={modifiers}
                modifiersClassNames={{
                  conPendientes: `${PUNTO} after:bg-amber-500`,
                  conCitas: `${PUNTO} after:bg-zinc-400 dark:after:bg-zinc-500`,
                }}
                className="w-full p-0 [--cell-size:--spacing(11)] md:[--cell-size:--spacing(10)]"
                classNames={{ root: "w-full md:w-fit" }}
              />
              <div className="flex items-center justify-center gap-4 pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />Por atender</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />Atendidas</span>
              </div>
            </CardContent>
          </Card>

          {agendaDia(false)}
        </div>
      )}
    </div>
  );
}
