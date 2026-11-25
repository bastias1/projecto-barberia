import { describe, expect, it } from "vitest";
import { aparienciaPorDefecto, leerApariencia, PRESETS, SECCIONES, TEMA_POR_DEFECTO } from "../lib/apariencia";
import { contraste, cssTema, modoEfectivo, paleta, textoSobre } from "../lib/apariencia-css";

// Apariencia de la página de una barbería (lib/apariencia*.ts): puro, sin Supabase.
describe("leerApariencia", () => {
  it("sin nada guardado usa el orden por defecto, con Productos oculta", () => {
    for (const vacio of [null, undefined, {}, "x", { secciones: "x" }, { secciones: [null, 3], tema: 4 }]) {
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

  it("en el tema solo pasan opciones conocidas y colores #rrggbb", () => {
    const malo = "red}</style><script>alert(1)</script>";
    const { tema } = leerApariencia({
      tema: { modo: malo, acento: malo, fondo: "#fff", tarjeta: "#AABBCC", fuente: "toString", radio: "recto", extra: malo },
    });
    expect(tema).toEqual({ ...TEMA_POR_DEFECTO, tarjeta: "#aabbcc", radio: "recto" });
    expect(cssTema(tema)).not.toContain("script");
  });

  it("los presets son temas válidos", () => {
    for (const { tema } of PRESETS) expect(leerApariencia({ tema }).tema).toEqual(tema);
  });
});

describe("cssTema", () => {
  const EXTREMOS = ["#000000", "#ffffff", "#777777", "#808080", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#a1ffcb", "#232323"];

  it("el tema por defecto no genera CSS", () => {
    expect(cssTema(TEMA_POR_DEFECTO)).toBe("");
  });

  it("los textos calculados cumplen contraste AA con cualquier fondo y acento", () => {
    for (const fondo of EXTREMOS) {
      for (const acento of [null, ...EXTREMOS]) {
        const p = paleta(fondo, acento);
        for (const sobre of [p.background, p.muted, p.accent]) expect(contraste(p.foreground, sobre)).toBeGreaterThanOrEqual(4.5);
        for (const sobre of [p.background, p.muted]) expect(contraste(p["muted-foreground"], sobre)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(textoSobre(fondo), fondo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("en automático ignora los colores de página y tarjeta; con modo fijo decide el fondo", () => {
    const tema = { ...TEMA_POR_DEFECTO, fondo: "#101010" };
    expect(modoEfectivo(tema)).toBeNull();
    expect(cssTema(tema)).toBe("");
    expect(modoEfectivo({ ...tema, modo: "claro" })).toBe("oscuro");
    expect(cssTema({ ...tema, modo: "claro" })).toContain("--background:#101010");
  });

  it("el vidrio siempre tiene un fondo que dejar ver", () => {
    expect(cssTema({ ...TEMA_POR_DEFECTO, superficie: "vidrio" })).toContain("body{background-image:radial-gradient");
    expect(cssTema({ ...TEMA_POR_DEFECTO, superficie: "vidrio", patron: "puntos" })).toContain("background-size:18px 18px");
  });

  it("un acento pálido no se usa como texto", () => {
    expect(cssTema({ ...TEMA_POR_DEFECTO, modo: "claro", acento: "#ffff00" })).toContain(".text-primary{color:var(--foreground)}");
    expect(cssTema({ ...TEMA_POR_DEFECTO, modo: "claro", acento: "#111111" })).not.toContain(".text-primary");
  });
});
