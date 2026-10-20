import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// PostgREST devuelve las relaciones embebidas como objeto o arreglo según la FK;
// sin tipos generados conviene normalizarlas a un solo objeto.
export function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null
  return (value ?? null) as T | null
}

// Solo rutas internas ("/algo", no "//dominio" ni URLs): evita redirecciones abiertas
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  return value
}

/** "Barbería Los Ríos" -> "barberia-los-rios" (formato de slug de la URL) */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
}
