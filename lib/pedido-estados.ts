import type { EstadoPagoPedido, EstadoPedido } from "./database.types";

export const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmado: { label: "Confirmado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  preparando: { label: "Preparando", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  listo_retiro: { label: "Listo para retiro", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  enviado: { label: "Enviado", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  entregado: { label: "Entregado", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export const ESTADO_PAGO: Record<EstadoPagoPedido, { label: string; className: string }> = {
  pendiente: { label: "Pago pendiente", className: "border border-yellow-600 bg-transparent text-yellow-600" },
  pagado: { label: "Pagado", className: "bg-green-500 text-white" },
  rechazado: { label: "Pago rechazado", className: "bg-red-500 text-white" },
  reembolsado: { label: "Reembolsado", className: "bg-zinc-500 text-white" },
};

/** Estados a los que el personal puede mover un pedido según su tipo de entrega. */
export function estadosDisponibles(tipoEntrega: string): EstadoPedido[] {
  return tipoEntrega === "despacho"
    ? ["confirmado", "preparando", "enviado", "entregado", "cancelado"]
    : ["confirmado", "preparando", "listo_retiro", "entregado", "cancelado"];
}

/** La dirección se guarda como JSON; pedidos antiguos pueden traer texto plano. */
export function parseDireccion(direccion: string | null): { lineas: string[]; telefono?: string } | null {
  if (!direccion) return null;
  try {
    const a = JSON.parse(direccion);
    return {
      lineas: [
        a.nombre_etiqueta,
        [a.calle, a.depto].filter(Boolean).join(", "),
        [a.comuna, a.ciudad].filter(Boolean).join(", "),
        a.region,
      ].filter(Boolean),
      telefono: a.telefono || undefined,
    };
  } catch {
    return { lineas: [direccion] };
  }
}
