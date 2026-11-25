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

export const MODOS = { auto: "Automático", claro: "Claro", oscuro: "Oscuro" };

// Opciones del tema: la primera de cada una es el aspecto por defecto
export const OPCIONES = {
  fuente: { geist: "Geist", inter: "Inter", "space-grotesk": "Space Grotesk", fraunces: "Fraunces", playfair: "Playfair Display", oswald: "Oswald" },
  titulos: { normal: "Normal", mayusculas: "MAYÚSCULAS", minusculas: "minúsculas" },
  radio: { grande: "Grandes", recto: "Rectas", pequeno: "Pequeñas", medio: "Medias", pildora: "Muy redondas" },
  borde: { linea: "Línea", ninguno: "Sin borde", discontinuo: "Discontinuo" },
  grosor: { fino: "Fino", medio: "Medio", grueso: "Grueso" },
  sombra: { ninguna: "Sin sombra", suave: "Suave", dura: "Dura", brillo: "Brillo" },
  hover: { ninguno: "Sin efecto", elevar: "Elevar", brillo: "Brillo", presionar: "Presionar" },
  superficie: { solida: "Sólida", vidrio: "Vidrio esmerilado" },
  patron: { ninguno: "Liso", degradado: "Degradado", puntos: "Puntos", cuadricula: "Cuadrícula" },
};

export const COLORES = { acento: "Color de acento", fondo: "Color de la página", tarjeta: "Color de las tarjetas" };

type Opciones = typeof OPCIONES;
export type Tema =
  { [K in keyof Opciones]: keyof Opciones[K] } &
  { [K in keyof typeof COLORES]: string | null } &
  { modo: keyof typeof MODOS };

export interface Apariencia {
  secciones: SeccionConfig[];
  tema: Tema;
}

export const TEMA_POR_DEFECTO: Tema = {
  modo: "auto", acento: null, fondo: null, tarjeta: null,
  fuente: "geist", titulos: "normal", radio: "grande", borde: "linea", grosor: "fino",
  sombra: "ninguna", hover: "ninguno", superficie: "solida", patron: "ninguno",
};

export const PRESETS: { nombre: string; tema: Tema }[] = [
  { nombre: "Sunwalk", tema: TEMA_POR_DEFECTO },
  {
    nombre: "Clásica",
    tema: { ...TEMA_POR_DEFECTO, modo: "oscuro", acento: "#c9a35c", fondo: "#14110f", tarjeta: "#1f1a16", fuente: "playfair", radio: "pequeno" },
  },
  {
    nombre: "Blanco y negro",
    tema: { ...TEMA_POR_DEFECTO, modo: "claro", acento: "#111111", fuente: "oswald", titulos: "mayusculas", radio: "recto", grosor: "medio", sombra: "dura", hover: "presionar" },
  },
  {
    nombre: "Pastel",
    tema: { ...TEMA_POR_DEFECTO, modo: "claro", acento: "#b4472b", fondo: "#fdf3ec", tarjeta: "#ffffff", fuente: "fraunces", radio: "pildora", borde: "ninguno", sombra: "suave", hover: "elevar", patron: "puntos" },
  },
  {
    nombre: "Neón",
    tema: { ...TEMA_POR_DEFECTO, modo: "oscuro", acento: "#a78bfa", fondo: "#0b0b12", tarjeta: "#15151f", fuente: "space-grotesk", sombra: "brillo", hover: "brillo", superficie: "vidrio", patron: "cuadricula" },
  },
];

const OCULTAS: SeccionId[] = ["productos"];

const porDefecto = (id: SeccionId): SeccionConfig => ({ id, visible: !OCULTAS.includes(id) });

export function aparienciaPorDefecto(): Apariencia {
  return { secciones: SECCIONES.map(porDefecto), tema: { ...TEMA_POR_DEFECTO } };
}

function leerSecciones(guardadas: unknown): SeccionConfig[] {
  const secciones = new Map<SeccionId, SeccionConfig>();
  for (const s of Array.isArray(guardadas) ? guardadas : []) {
    const id = SECCIONES.find((x) => x === s?.id);
    if (id && !secciones.has(id) && typeof s.visible === "boolean") secciones.set(id, { id, visible: s.visible });
  }
  for (const id of SECCIONES) {
    if (!secciones.has(id)) secciones.set(id, porDefecto(id));
  }
  return [...secciones.values()];
}

// Los valores terminan en CSS: solo pasan opciones conocidas y colores #rrggbb
function leerTema(guardado: unknown): Tema {
  const g = (guardado ?? {}) as Record<string, unknown>;
  const tema: Record<string, unknown> = { ...TEMA_POR_DEFECTO };
  for (const [campo, opciones] of Object.entries({ ...OPCIONES, modo: MODOS })) {
    const valor = g[campo];
    if (typeof valor === "string" && Object.hasOwn(opciones, valor)) tema[campo] = valor;
  }
  for (const campo of Object.keys(COLORES)) {
    const valor = g[campo];
    if (typeof valor === "string" && /^#[0-9a-f]{6}$/i.test(valor)) tema[campo] = valor.toLowerCase();
  }
  return tema as Tema;
}

/**
 * Lee lo guardado (o recibido por la vista previa). El admin puede escribir cualquier JSON por la API:
 * solo pasa lo conocido; lo demás vuelve a su valor por defecto.
 */
export function leerApariencia(json: unknown): Apariencia {
  const g = (json ?? {}) as { secciones?: unknown; tema?: unknown };
  return { secciones: leerSecciones(g.secciones), tema: leerTema(g.tema) };
}

/** Qué muestra la vista previa: el inicio real, o Reservar y Tienda con datos de ejemplo. */
export type PaginaPrevia = "inicio" | "reserva" | "tienda";

/** Mensajes entre el editor del dashboard y la página en su iframe de vista previa. */
export const MENSAJE_LISTA = "apariencia-lista";
export const MENSAJE_BORRADOR = "apariencia-borrador";
