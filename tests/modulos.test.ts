import { describe, expect, it } from "vitest";
import { MODULOS, suscripcionVigente, tieneModulo, TEXTO_PANEL, TEXTO_PUBLICO } from "../lib/modulos";
import { MODULO_LABEL } from "../lib/planes";

// Módulos de la suscripción (lib/modulos.ts): puro, sin Supabase.
describe("tieneModulo / suscripcionVigente", () => {
  it("tieneModulo mira la lista vigente", () => {
    expect(tieneModulo(["agenda", "bi"], "bi")).toBe(true);
    expect(tieneModulo(["agenda"], "ecommerce")).toBe(false);
    expect(tieneModulo([], "agenda")).toBe(false);
  });

  it("la suscripción está vigente solo si queda el módulo base `agenda`", () => {
    expect(suscripcionVigente(["agenda"])).toBe(true);
    expect(suscripcionVigente(["agenda", "ecommerce", "bi"])).toBe(true);
    expect(suscripcionVigente(["ecommerce", "bi"])).toBe(false); // vencida: sin base
    expect(suscripcionVigente([])).toBe(false);
  });
});

describe("textos de módulo", () => {
  it("cada módulo tiene su etiqueta para las tarjetas de plan", () => {
    for (const m of MODULOS) expect(MODULO_LABEL[m], m).toBeTruthy();
  });

  it("los paneles del dashboard (tienda y estadísticas) y los textos públicos (tienda y agenda) están completos", () => {
    for (const t of [...Object.values(TEXTO_PANEL), ...Object.values(TEXTO_PUBLICO)]) {
      expect(t.titulo.length).toBeGreaterThan(0);
      expect(t.descripcion.length).toBeGreaterThan(0);
    }
    expect(Object.keys(TEXTO_PANEL).sort()).toEqual(["bi", "ecommerce"]);
    expect(Object.keys(TEXTO_PUBLICO).sort()).toEqual(["agenda", "ecommerce"]);
  });
});
