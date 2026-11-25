import { describe, expect, it } from "vitest";
import { aparienciaPorDefecto, leerApariencia, PRESETS, SECCIONES, TEMA_POR_DEFECTO } from "../lib/apariencia";
import { rutaImagen } from "../lib/imagenes";
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

  it("el diseño es uno conocido y la foto de portada solo viene de nuestro Storage", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    const base = "https://proyecto.supabase.co/storage/v1/object/public/imgs/barberias/";
    const buena = `${base}1b2c-3d/portada/1700000000000_ab12cd.jpg`;
    expect(leerApariencia({ diseno: "columna", portada: buena })).toMatchObject({ diseno: "columna", portada: buena });
    for (const portada of ["https://otro.example/x.jpg", `${base}1b2c/logo/x.jpg`, `${base}1b2c/portada/../../x.jpg`, `${buena}?a="><script>`, "javascript:alert(1)", 5]) {
      expect(leerApariencia({ diseno: "toString", portada })).toMatchObject({ diseno: "clasico", portada: null });
    }
  });

  it("acepta como portada lo que genera la subida", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    for (const archivo of ["Foto.JPG", "foto sin extension", "a.b.webp"]) {
      const url = `https://proyecto.supabase.co/storage/v1/object/public/imgs/${rutaImagen("1b2c-3d", "portada", archivo)}`;
      expect(leerApariencia({ portada: url }).portada).toBe(url);
    }
  });

  it("el encuadre de la foto queda dentro de sus límites", () => {
    expect(leerApariencia({ encuadre: { x: -20, y: 33.6, zoom: 999 } }).encuadre).toEqual({ x: 0, y: 34, zoom: 200 });
    expect(leerApariencia({ encuadre: { x: "10", y: NaN, zoom: null } }).encuadre).toEqual({ x: 50, y: 50, zoom: 100 });
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

  it("el vidrio no pisa el fondo de hover ni de la opción elegida", () => {
    const css = cssTema({ ...TEMA_POR_DEFECTO, superficie: "vidrio" });
    expect(css).toContain("{--card:transparent}");
    expect(css).toContain("::before{content:''");
  });

  it("las sombras pueden tener un color distinto del acento", () => {
    const css = cssTema(leerApariencia({ tema: { acento: "#111111", sombra: "brillo", colorSombra: "#FF0000" } }).tema);
    expect(css).toContain("--sombra:#ff0000");
    expect(css).toContain("var(--sombra,var(--brand))");
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
