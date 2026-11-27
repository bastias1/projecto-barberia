type Reserva = { fecha_hora_inicio: string; estado: string; barberia_activa: boolean };

/** Se puede cambiar o cancelar desde la cuenta (el plazo lo decide la BD). */
export const esModificable = (r: Reserva, ahora: number) =>
  r.barberia_activa && ["pendiente", "confirmada"].includes(r.estado) && Date.parse(r.fecha_hora_inicio) > ahora;

/** Próximas (modificables, la más cercana primero) y anteriores (el resto, la más reciente primero). */
export function separarReservas<T extends Reserva>(reservas: T[], ahora: number) {
  const porFecha = (a: T, b: T) => Date.parse(a.fecha_hora_inicio) - Date.parse(b.fecha_hora_inicio);
  return {
    proximas: reservas.filter((r) => esModificable(r, ahora)).sort(porFecha),
    anteriores: reservas.filter((r) => !esModificable(r, ahora)).sort((a, b) => porFecha(b, a)),
  };
}
