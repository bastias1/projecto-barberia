/**
 * RUT chileno válido (dígito verificador, módulo 11) en la forma que acepta Mercado Pago: "12345678-5".
 * Acepta puntos, guion, espacios y la K en minúscula. Devuelve null si no es un RUT válido.
 */
export function normalizarRut(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const m = /^(\d{7,8})([\dK])$/.exec(texto.replace(/[.\s-]/g, "").toUpperCase());
  if (!m) return null;
  const [, cuerpo, dv] = m;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado ? `${cuerpo}-${dv}` : null;
}
