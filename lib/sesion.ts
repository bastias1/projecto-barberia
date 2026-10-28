/**
 * "Mantener sesión iniciada". @supabase/ssr guarda las cookies de sesión con
 * maxAge de 400 días y no permite cambiarlo, así que los setAll de los
 * clientes (navegador, servidor, middleware) pasan las opciones por aquí:
 * si la persona no quiere mantener la sesión, quedan como cookies de sesión
 * del navegador (sin maxAge ni expires) y se borran al cerrarlo.
 */

// Preferencia elegida al iniciar sesión: "1" mantener, "0" solo esta sesión del navegador
export const RECORDAR_COOKIE = "sb-recordar";

// La misma duración que usa @supabase/ssr
export const RECORDAR_MAX_AGE = 400 * 24 * 60 * 60;

export function sesionPersistente(valor: string | undefined | null): boolean {
  return valor !== "0";
}

type OpcionesCookie = { maxAge?: number; expires?: Date | number | string; [key: string]: unknown };

/** Opciones de una cookie de Supabase según la preferencia (las que borran, maxAge 0, no se tocan). */
export function opcionesCookie<T extends OpcionesCookie>(options: T | undefined, persistente: boolean): T | undefined {
  if (persistente || !options || !options.maxAge || options.maxAge <= 0) return options;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...resto } = options;
  return resto as T;
}
