import { describe, expect, it } from "vitest";
import { normalizarRut } from "../lib/rut";

describe("normalizarRut", () => {
  it.each([
    ["12.345.678-5", "12345678-5"], ["12345678-5", "12345678-5"], ["12345678 5", "12345678-5"],
    ["7.654.321-6", "7654321-6"], ["11.111.111-1", "11111111-1"],
    ["12.345.675-0", "12345675-0"], // dígito verificador 0
    ["12.345.670-K", "12345670-K"], ["12345670-k", "12345670-K"], // dígito verificador K, también en minúscula
  ])("%s es válido", (entrada, esperado) => expect(normalizarRut(entrada)).toBe(esperado));

  it.each([
    ["dígito verificador equivocado", "12.345.678-9"], ["muy corto", "1234-5"], ["muy largo", "123456789-0"],
    ["letras", "abcdefgh-1"], ["vacío", ""], ["solo espacios", "   "],
  ])("%s no es válido", (_, entrada) => expect(normalizarRut(entrada)).toBeNull());

  it.each([undefined, null, 12345678, {}])("un valor que no es texto (%s) no es válido", (entrada) => expect(normalizarRut(entrada)).toBeNull());
});
