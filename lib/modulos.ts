/*
 * Módulos de la suscripción (tabla `modulo`). Puro: sirve en servidor y en cliente.
 * La lista vigente de una barbería viene del RPC `modulos_barberia` (getModulosCached /
 * useModulos). La base de datos ya impone los módulos con triggers y RLS; esto es solo
 * lo que ve la interfaz.
 */
export const MODULOS = ["agenda", "ecommerce", "bi", "calendario", "pronostico"] as const;
export type ModuloCodigo = (typeof MODULOS)[number];

export const tieneModulo = (modulos: readonly string[], codigo: ModuloCodigo): boolean => modulos.includes(codigo);

/** `agenda` es el módulo base: desaparece cuando la suscripción vence, así que es la señal de "vigente". */
export const suscripcionVigente = (modulos: readonly string[]): boolean => tieneModulo(modulos, "agenda");

const FUERA_DEL_PLAN = "Cambia a un plan que lo incluya para activarlo.";

/** Panel del dashboard cuando el plan de la barbería no incluye el módulo. */
export const TEXTO_PANEL = {
  ecommerce: { titulo: "La tienda no está incluida en tu plan", descripcion: FUERA_DEL_PLAN },
  bi: { titulo: "Las estadísticas no están incluidas en tu plan", descripcion: FUERA_DEL_PLAN },
} as const;
export type ModuloConPanel = keyof typeof TEXTO_PANEL;

/** Lo que ve el público cuando la barbería no tiene el módulo. */
export const TEXTO_PUBLICO = {
  ecommerce: {
    titulo: "La tienda no está disponible",
    descripcion: "Esta barbería no tiene la tienda en línea activa en este momento.",
  },
  agenda: {
    titulo: "Reservas en línea no disponibles",
    descripcion: "Esta barbería no está recibiendo reservas en línea en este momento. Contáctala directamente para agendar.",
  },
} as const;
export type ModuloPublico = keyof typeof TEXTO_PUBLICO;
