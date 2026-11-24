import { volverAlDashboard } from "../volver";

export type ResultadoMercadoPago = "ok" | "error" | "no-configurado" | "desconectado" | "en-uso";

/** Vuelve a Mi Barbería con ?mercadopago=<resultado>. */
export const volverABarberia = (request: Request, slug: string | null, resultado: ResultadoMercadoPago) =>
  volverAlDashboard(request, slug, `barberia?mercadopago=${resultado}`);
