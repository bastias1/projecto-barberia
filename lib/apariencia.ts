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

// Cómo se acomodan el encabezado y las secciones en el inicio
export const DISENOS = { clasico: "Clásico", columna: "Dos columnas", portada: "Portada con foto" };

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

export const COLORES = { acento: "Color de acento", fondo: "Color de la página", tarjeta: "Color de las tarjetas", colorSombra: "Color de sombras y brillos" };

type Opciones = typeof OPCIONES;
export type Tema =
  { [K in keyof Opciones]: keyof Opciones[K] } &
  { [K in keyof typeof COLORES]: string | null } &
  { modo: keyof typeof MODOS };

/** Qué parte de la foto de portada se ve: punto (x, y) en % y acercamiento en %. */
export const ENCUADRE = {
  x: { nombre: "Horizontal", min: 0, max: 100, base: 50 },
  y: { nombre: "Vertical", min: 0, max: 100, base: 50 },
  zoom: { nombre: "Acercar", min: 100, max: 200, base: 100 },
};
export type Encuadre = Record<keyof typeof ENCUADRE, number>;

export const ENCUADRE_POR_DEFECTO: Encuadre = { x: 50, y: 50, zoom: 100 };

export interface Apariencia {
  secciones: SeccionConfig[];
  tema: Tema;
  diseno: keyof typeof DISENOS;
  /** Foto de portada subida a la carpeta de la barbería; se usa con el diseño "portada". */
  portada: string | null;
  encuadre: Encuadre;
}

export const TEMA_POR_DEFECTO: Tema = {
  modo: "auto", acento: null, fondo: null, tarjeta: null, colorSombra: null,
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
  return { secciones: SECCIONES.map(porDefecto), tema: { ...TEMA_POR_DEFECTO }, diseno: "clasico", portada: null, encuadre: { ...ENCUADRE_POR_DEFECTO } };
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

// Solo fotos subidas a barberias/<id>/portada/ de nuestro Storage
function leerPortada(url: unknown): string | null {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")}/storage/v1/object/public/imgs/barberias/`;
  return typeof url === "string" && url.startsWith(base) && /^[0-9a-f-]+\/portada\/\w+\.\w+$/i.test(url.slice(base.length)) ? url : null;
}

function leerEncuadre(guardado: unknown): Encuadre {
  const g = (guardado ?? {}) as Record<string, unknown>;
  const encuadre = { ...ENCUADRE_POR_DEFECTO };
  for (const [campo, { min, max }] of Object.entries(ENCUADRE)) {
    const valor = g[campo];
    if (typeof valor === "number" && Number.isFinite(valor)) encuadre[campo as keyof Encuadre] = Math.min(max, Math.max(min, Math.round(valor)));
  }
  return encuadre;
}

/**
 * Lee lo guardado (o recibido por la vista previa). El admin puede escribir cualquier JSON por la API:
 * solo pasa lo conocido; lo demás vuelve a su valor por defecto.
 */
export function leerApariencia(json: unknown): Apariencia {
  const g = (json ?? {}) as { secciones?: unknown; tema?: unknown; diseno?: unknown; portada?: unknown; encuadre?: unknown };
  const diseno = typeof g.diseno === "string" && Object.hasOwn(DISENOS, g.diseno) ? (g.diseno as Apariencia["diseno"]) : "clasico";
  return { secciones: leerSecciones(g.secciones), tema: leerTema(g.tema), diseno, portada: leerPortada(g.portada), encuadre: leerEncuadre(g.encuadre) };
}
