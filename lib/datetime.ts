import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DEFAULT_TZ } from "./barberia";

/**
 * Las reservas se guardan como timestamptz. Estas utilidades convierten entre
 * instantes UTC y fecha/hora local de la sucursal, sin depender de la zona
 * horaria del servidor (Vercel corre en UTC) ni del navegador.
 */

export interface ZonedParts {
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:mm
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string) {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

function partsOf(date: Date, tz: string) {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(tz).formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

/** Fecha y hora local (en `tz`) de un instante. */
export function toZoned(value: Date | string, tz: string = DEFAULT_TZ): ZonedParts {
  const p = partsOf(typeof value === "string" ? new Date(value) : value, tz);
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** Diferencia (ms) entre la hora local de `tz` y UTC en ese instante. */
function tzOffset(utcMs: number, tz: string) {
  const p = partsOf(new Date(utcMs), tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Instante UTC que corresponde a `fecha` + `hora` locales de `tz`. */
export function fromZoned(fecha: string, hora: string, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let utc = guess - tzOffset(guess, tz);
  // Segunda pasada por si el offset cambia justo en el cambio de horario
  utc = guess - tzOffset(utc, tz);
  return new Date(utc);
}

/** Fecha de hoy (YYYY-MM-DD) en `tz`. */
export function todayIn(tz: string = DEFAULT_TZ): string {
  return toZoned(new Date(), tz).fecha;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(fecha: string, days: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export function dayOfWeek(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** YYYY-MM-DD de un Date usando sus partes locales (fechas elegidas en un calendario). */
export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formatea una fecha YYYY-MM-DD (sin desplazarla por zona horaria). */
export function formatFecha(fecha: string, pattern = "dd MMM yyyy"): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return format(new Date(y, m - 1, d), pattern, { locale: es });
}

export function formatCLP(value: number | null | undefined): string {
  return `$${Math.round(Number(value) || 0).toLocaleString("es-CL")}`;
}
