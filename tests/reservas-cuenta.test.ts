import { describe, expect, it } from "vitest";
import { separarReservas } from "../lib/reservas-cuenta";

// Cuenta → Reservas: Próximas (se pueden cambiar) y Anteriores (el resto). Sin Supabase.
const AHORA = Date.parse("2026-11-26T12:00:00Z");
const r = (id: number, inicio: string, estado = "confirmada", barberia_activa = true) =>
  ({ id_reserva: id, fecha_hora_inicio: inicio, estado, barberia_activa });

describe("separarReservas", () => {
  it("próximas: futuras pendiente/confirmada de barberías activas, la más cercana primero", () => {
    const { proximas } = separarReservas([
      r(1, "2026-12-10T15:00:00Z"),
      r(2, "2026-11-28T15:00:00Z", "pendiente"),
      r(3, "2026-12-01T15:00:00Z"),
    ], AHORA);
    expect(proximas.map((x) => x.id_reserva)).toEqual([2, 3, 1]);
  });

  it("anteriores: pasadas, canceladas, completadas y de barberías inactivas, la más reciente primero", () => {
    const { proximas, anteriores } = separarReservas([
      r(1, "2026-10-01T15:00:00Z", "completada"),
      r(2, "2026-12-05T15:00:00Z", "cancelada"),
      r(3, "2026-12-03T15:00:00Z", "confirmada", false),
      r(4, "2026-11-26T11:00:00Z"), // confirmada pero ya pasó
    ], AHORA);
    expect(proximas).toEqual([]);
    expect(anteriores.map((x) => x.id_reserva)).toEqual([2, 3, 4, 1]);
  });
});
