import type { EstadoClave, FilaBarberia } from "./admin-datos";

/* Filtros y orden de la tabla de barberías del panel (/admin/barberias), leídos de la URL. */

export const GRUPOS_ESTADO: { clave: string; label: string; incluye: EstadoClave[] }[] = [
  { clave: "pagando", label: "Pagando", incluye: ["activa_mp", "activa"] },
  { clave: "prueba", label: "En prueba", incluye: ["prueba"] },
  { clave: "cortesia", label: "Cortesía", incluye: ["cortesia"] },
  { clave: "vencidas", label: "Vencidas", incluye: ["vencida", "sin"] },
  { clave: "suspendidas", label: "Suspendidas", incluye: ["suspendida"] },
];

export interface ParamsBarberias {
  q?: string;
  estado?: string;
  plan?: string;
  region?: string;
  desde?: string;
  hasta?: string;
  orden?: string;
  dir?: string;
}

/** Valores de un parámetro `a,b,c` (vacío = sin filtro). */
export const lista = (valor?: string) => (valor ?? "").split(",").map((v) => v.trim()).filter(Boolean);

const ORDEN: Record<string, (b: FilaBarberia) => string | number | null> = {
  nombre: (b) => b.nombre.toLowerCase(),
  vence: (b) => b.suscripcion?.fecha_termino ?? null,
  barberos: (b) => b.barberos,
  reservas: (b) => b.reservasMes,
};

/** Fila sin filtro de estado: sirve para contar cuántas hay de cada estado con los demás filtros puestos. */
export function filtrarBarberias(filas: FilaBarberia[], p: ParamsBarberias, { sinEstado = false } = {}): FilaBarberia[] {
  const texto = (p.q ?? "").trim().toLowerCase();
  const estados = new Set(GRUPOS_ESTADO.filter((g) => lista(p.estado).includes(g.clave)).flatMap((g) => g.incluye));
  const planes = lista(p.plan);
  const regiones = lista(p.region);

  const filtradas = filas.filter((b) => {
    const vence = b.suscripcion?.fecha_termino ?? null;
    return (
      (sinEstado || estados.size === 0 || estados.has(b.estado.clave)) &&
      (planes.length === 0 || (b.plan !== null && planes.includes(b.plan))) &&
      (regiones.length === 0 || b.regiones.some((r) => regiones.includes(r))) &&
      // Con rango de fechas, las que no vencen quedan fuera
      (!p.desde || (vence !== null && vence.slice(0, 10) >= p.desde)) &&
      (!p.hasta || (vence !== null && vence.slice(0, 10) <= p.hasta)) &&
      (!texto || b.nombre.toLowerCase().includes(texto) || b.slug.includes(texto) || b.duenos.some((d) => d.email.toLowerCase().includes(texto)))
    );
  });

  const clave = p.orden ? ORDEN[p.orden] : undefined;
  if (!clave) return filtradas;
  const signo = p.dir === "desc" ? -1 : 1;
  // Los vacíos (sin vencimiento) siempre al final
  return [...filtradas].sort((a, b) => {
    const x = clave(a), y = clave(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * signo;
  });
}
