import { describe, expect, it } from "vitest";
import { aparienciaPorDefecto, leerApariencia, SECCIONES } from "../lib/apariencia";

// Apariencia de la página de una barbería (lib/apariencia.ts): puro, sin Supabase.
describe("leerApariencia", () => {
  it("sin nada guardado usa el orden por defecto, con Productos oculta", () => {
    for (const vacio of [null, undefined, {}, "x", { secciones: "x" }, { secciones: [null, 3] }]) {
      expect(leerApariencia(vacio)).toEqual(aparienciaPorDefecto());
    }
    expect(aparienciaPorDefecto().secciones.filter((s) => !s.visible).map((s) => s.id)).toEqual(["productos"]);
  });

  it("respeta orden y visibilidad, y agrega al final las que faltan", () => {
    const { secciones } = leerApariencia({ secciones: [{ id: "opiniones", visible: true }, { id: "galeria", visible: false }] });
    expect(secciones.slice(0, 2)).toEqual([{ id: "opiniones", visible: true }, { id: "galeria", visible: false }]);
    expect(secciones.map((s) => s.id).sort()).toEqual([...SECCIONES].sort());
  });

  it("descarta secciones desconocidas, repetidas, mal formadas y campos extra", () => {
    const { secciones } = leerApariencia({
      secciones: [
        { id: "<script>", visible: true },
        { id: "equipo", visible: "no" },
        { id: "horario", visible: false, titulo: "x" },
        { id: "horario", visible: true },
      ],
    });
    expect(secciones[0]).toEqual({ id: "horario", visible: false });
    expect(secciones).toHaveLength(SECCIONES.length);
    expect(secciones.find((s) => s.id === "equipo")?.visible).toBe(true);
  });
});
