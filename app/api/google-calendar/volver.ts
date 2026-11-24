import { volverAlDashboard } from "../volver";

export type ResultadoCalendario = "ok" | "error" | "no-configurado" | "desconectado";

/** Vuelve a Configuración del dashboard con ?calendario=<resultado>. */
export const volverAConfiguracion = (request: Request, slug: string | null, resultado: ResultadoCalendario) =>
  volverAlDashboard(request, slug, `configuracion?calendario=${resultado}`);
