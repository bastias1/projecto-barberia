/** Apariencia de la página de una barbería (columna `barberia.apariencia`). */

// El orden de esta lista es el orden por defecto
export const SECCIONES = [
  "sucursales", "servicios", "equipo", "galeria", "sobre", "horario", "ubicacion", "opiniones", "productos",
] as const;

export type SeccionId = (typeof SECCIONES)[number];

export const SECCION_NOMBRE: Record<SeccionId, string> = {
  sucursales: "Sucursales",
  servicios: "Servicios",
  equipo: "Equipo",
  galeria: "Trabajos recientes",
  sobre: "Sobre nosotros",
  horario: "Horario",
  ubicacion: "Ubicación",
  opiniones: "Opiniones de clientes",
  productos: "Productos",
};

export interface SeccionConfig {
  id: SeccionId;
  visible: boolean;
}

export interface Apariencia {
  secciones: SeccionConfig[];
}

const OCULTAS: SeccionId[] = ["productos"];

const porDefecto = (id: SeccionId): SeccionConfig => ({ id, visible: !OCULTAS.includes(id) });

export function aparienciaPorDefecto(): Apariencia {
  return { secciones: SECCIONES.map(porDefecto) };
}

/**
 * Lee lo guardado (o recibido por la vista previa). El admin puede escribir cualquier JSON por la API:
 * solo pasa lo conocido; lo desconocido o repetido se descarta y lo que falta se agrega al final.
 */
export function leerApariencia(json: unknown): Apariencia {
  const guardadas: unknown = (json as { secciones?: unknown } | null)?.secciones;
  const secciones = new Map<SeccionId, SeccionConfig>();

  for (const s of Array.isArray(guardadas) ? guardadas : []) {
    const id = SECCIONES.find((x) => x === s?.id);
    if (id && !secciones.has(id) && typeof s.visible === "boolean") secciones.set(id, { id, visible: s.visible });
  }
  for (const id of SECCIONES) {
    if (!secciones.has(id)) secciones.set(id, porDefecto(id));
  }
  return { secciones: [...secciones.values()] };
}

/** Mensajes entre el editor del dashboard y la página en su iframe de vista previa. */
export const MENSAJE_LISTA = "apariencia-lista";
export const MENSAJE_BORRADOR = "apariencia-borrador";
