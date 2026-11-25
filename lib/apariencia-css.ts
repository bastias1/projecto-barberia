/**
 * Convierte el tema de una barbería en CSS que pisa los tokens de app/globals.css. Los colores de texto
 * nunca se eligen: se calculan para cumplir contraste AA. El tema por defecto no genera nada.
 */
import type { Tema } from "./apariencia";

const BLANCO = "#ffffff";
const NEGRO = "#000000";
// Fondo y tarjeta de cada modo en app/globals.css
const BASE = { claro: { fondo: BLANCO, tarjeta: BLANCO }, oscuro: { fondo: "#0d0e0e", tarjeta: "#151716" } };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [alto, bajo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (bajo + 0.05);
}

/** Blanco o negro: el que más contraste tenga (siempre alcanza 4,5:1). */
export const textoSobre = (fondo: string) => (contraste(BLANCO, fondo) >= contraste(NEGRO, fondo) ? BLANCO : NEGRO);

function mezcla(a: string, b: string, t: number): string {
  const de = rgb(a);
  return "#" + rgb(b).map((c, i) => Math.round(de[i] + (c - de[i]) * t).toString(16).padStart(2, "0")).join("");
}

/** Colores que acompañan a un fondo elegido (la página o las tarjetas). */
export function paleta(fondo: string, acento: string | null) {
  const texto = textoSobre(fondo);
  const suave = mezcla(fondo, texto, 0.05);
  const muted = contraste(texto, suave) >= 4.5 ? suave : fondo;
  const tenue = [0.65, 0.75, 0.85]
    .map((t) => mezcla(fondo, texto, t))
    .find((c) => contraste(c, fondo) >= 4.5 && contraste(c, muted) >= 4.5) ?? texto;
  const tinte = mezcla(fondo, acento ?? texto, 0.12);

  return {
    background: fondo,
    foreground: texto,
    muted,
    "muted-foreground": tenue,
    secondary: muted,
    "secondary-foreground": texto,
    accent: contraste(texto, tinte) >= 4.5 ? tinte : muted,
    "accent-foreground": texto,
    border: mezcla(fondo, texto, 0.15),
    rule: mezcla(fondo, texto, 0.15),
    input: mezcla(fondo, texto, 0.22),
  };
}

const vars = (v: Record<string, string>) => Object.entries(v).map(([k, valor]) => `--${k}:${valor}`).join(";");
const regla = (selector: string, cuerpo: string) => `${selector}{${cuerpo}}`;

const TARJETA = ":is(.tarjeta,[data-slot=card])";
export const RADIOS = { recto: ["0px", "0px"], pequeno: ["0.375rem", "0.25rem"], medio: ["0.75rem", "0.5rem"], grande: null, pildora: ["2rem", "1.5rem"] };
export const GROSORES = { fino: "1px", medio: "2px", grueso: "3px" };
export const SOMBRAS = {
  ninguna: null,
  suave: "0 10px 30px -14px rgb(0 0 0 / 0.3)",
  dura: "4px 4px 0 var(--foreground)",
  brillo: "0 0 28px -8px var(--brand)",
};
const HOVERS = {
  ninguno: null,
  elevar: "transform:translateY(-3px)",
  brillo: "box-shadow:0 0 28px -4px var(--brand)",
  presionar: "transform:translate(2px,2px)",
};
const linea = "color-mix(in srgb,var(--foreground) 9%,transparent)";
const mancha = (posicion: string, color: string) => `radial-gradient(circle at ${posicion},${color},transparent 38%)`;
const MANCHAS = "background-image:" + [
  mancha("12% 18%", "color-mix(in srgb,var(--brand) 55%,transparent)"),
  mancha("88% 42%", "rgb(124 58 237 / 0.4)"),
  mancha("22% 82%", "rgb(14 165 233 / 0.35)"),
  mancha("78% 92%", "color-mix(in srgb,var(--brand) 45%,transparent)"),
].join(",");
export const PATRONES = {
  ninguno: null,
  degradado: "background-image:linear-gradient(160deg,color-mix(in srgb,var(--brand) 28%,transparent),transparent 60%)",
  puntos: `background-image:radial-gradient(color-mix(in srgb,var(--foreground) 16%,transparent) 1px,transparent 1px);background-size:18px 18px`,
  cuadricula: `background-image:linear-gradient(${linea} 1px,transparent 1px),linear-gradient(90deg,${linea} 1px,transparent 1px);background-size:32px 32px`,
};

/** Modo que se fuerza en la página, o null si sigue al visitante. Un fondo propio decide si es claro u oscuro. */
export function modoEfectivo(tema: Tema): "claro" | "oscuro" | null {
  if (tema.modo === "auto") return null;
  if (!tema.fondo) return tema.modo;
  return textoSobre(tema.fondo) === BLANCO ? "oscuro" : "claro";
}

function reglasAcento(acento: string, fondo: string, raiz: string, prefijo: string): string {
  const legible = contraste(acento, fondo);
  let css = regla(raiz, vars({
    brand: acento,
    "brand-foreground": textoSobre(acento),
    primary: acento,
    "primary-foreground": textoSobre(acento),
    ring: legible >= 3 ? acento : textoSobre(fondo),
    accent: paleta(fondo, acento).accent,
  }));
  // Un acento pálido sirve de relleno, no de texto ni de borde de selección
  if (legible < 4.5) css += regla(`${prefijo} .text-primary`, "color:var(--foreground)") + regla(`${prefijo} .border-primary`, "border-color:var(--ring)");
  return css;
}

/** `familia` es el font-family de next/font de la fuente elegida; null deja la de la plataforma. */
export function cssTema(tema: Tema, familia: string | null = null): string {
  let css = "";
  const modo = modoEfectivo(tema);
  const { acento } = tema;
  // Colores propios solo con modo fijo: en automático no podrían servir a claro y oscuro a la vez
  const fondo = modo ? tema.fondo : null;
  const tarjeta = modo ? tema.tarjeta : null;

  if (modo && (fondo || tarjeta)) {
    const pagina = fondo ?? BASE[modo].fondo;
    const caja = tarjeta ?? fondo ?? BASE[modo].tarjeta;
    const enPagina = paleta(pagina, acento);
    css += regla(":root:root", vars({
      ...enPagina,
      card: caja,
      "card-foreground": textoSobre(caja),
      popover: pagina,
      "popover-foreground": enPagina.foreground,
    }));
    // Dentro de una tarjeta todo se calcula contra su color
    css += regla(TARJETA, `${vars({ ...paleta(caja, acento), "card-foreground": textoSobre(caja) })};color:var(--foreground)`);
    // Los campos seguros de Mercado Pago escriben en oscuro: necesitan fondo claro
    if (textoSobre(caja) === BLANCO) {
      css += regla("#form-checkout__cardNumber,#form-checkout__expirationDate,#form-checkout__securityCode", "background-color:#fff");
    }
  }

  if (acento) {
    css += modo
      ? reglasAcento(acento, fondo ?? BASE[modo].fondo, ":root:root", "")
      : reglasAcento(acento, BASE.claro.fondo, ":root:root", ":root:not(.dark)") +
        reglasAcento(acento, BASE.oscuro.fondo, ":root.dark", ":root.dark");
  }

  if (familia) css += regla("body[class]", `--font-geist-sans:${familia};--font-host:${familia};font-family:${familia}`);
  if (tema.titulos !== "normal") {
    css += regla("main :is(h1,h2,h3),.display", `text-transform:${tema.titulos === "mayusculas" ? "uppercase" : "lowercase"}`);
  }

  const radio = RADIOS[tema.radio];
  if (radio) css += regla(":root:root", `--radius:${radio[1]}`) + regla(TARJETA, `border-radius:${radio[0]}`);
  if (tema.borde !== "linea" || tema.grosor !== "fino") {
    const ancho = tema.borde === "ninguno" ? "0px" : GROSORES[tema.grosor];
    css += regla(TARJETA, `border-width:${ancho};border-style:${tema.borde === "discontinuo" ? "dashed" : "solid"}`);
  }
  if (SOMBRAS[tema.sombra]) css += regla(TARJETA, `box-shadow:${SOMBRAS[tema.sombra]}`);
  if (HOVERS[tema.hover]) {
    css += `@media (prefers-reduced-motion:no-preference){${regla(TARJETA, "transition:transform .2s,box-shadow .2s")}${regla(`${TARJETA}:hover`, HOVERS[tema.hover]!)}}`;
  }
  if (tema.superficie === "vidrio") {
    // Las que llevan GlassSurface (components/vidrio.tsx) dejan ver a través; el resto usa este vidrio en CSS.
    // La opción elegida (bg-accent) conserva su color.
    const caja = ":is(.tarjeta.bg-card,[data-slot=card])";
    css += regla(`${caja}:not(:has(>.vidrio))`, "background-color:color-mix(in srgb,var(--card) 65%,transparent);backdrop-filter:blur(12px)");
    css += regla(`${caja}:has(>.vidrio)`, "background-color:transparent");
    // En la capa base para que `sticky` de una tarjeta siga mandando
    css += `@layer base{${regla(":where(.tarjeta,[data-slot=card]):has(>.vidrio)", "position:relative;isolation:isolate")}}`;
  }
  // El vidrio no se nota sobre un color liso: sin otro fondo elegido se ponen manchas de color
  const patron = PATRONES[tema.patron] ?? (tema.superficie === "vidrio" ? MANCHAS : null);
  if (patron) {
    css += regla("body", `${patron};background-attachment:fixed`) + regla(".min-h-dvh.bg-background", "background-color:transparent");
  }

  return css;
}
