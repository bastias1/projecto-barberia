import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface ConexionMercadoPago {
  cuenta: string | null;
  estado: "conectada" | "desconectada";
  ultimo_error: string | null;
}

const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  ok: { texto: "Mercado Pago quedó conectado. Los pagos de tu tienda llegan directo a tu cuenta." },
  desconectado: { texto: "Mercado Pago quedó desconectado. La tienda no podrá cobrar hasta que lo vuelvas a conectar." },
  error: { texto: "No se pudo completar la acción con Mercado Pago. Intenta nuevamente.", error: true },
  "no-configurado": { texto: "La conexión con Mercado Pago aún no está disponible.", error: true },
  "en-uso": { texto: "Esa cuenta de Mercado Pago ya está conectada a otra barbería. Usa otra cuenta.", error: true },
};

/** Conectar / desconectar la cuenta de Mercado Pago que recibe los pagos de la tienda (Mi Barbería). */
export function MercadoPagoConexion({ slug, conexion, configurado, resultado }: {
  slug: string;
  conexion: ConexionMercadoPago | null;
  configurado: boolean;
  resultado?: string;
}) {
  const aviso = resultado ? AVISOS[resultado] : undefined;
  const conectar = (
    <Button asChild>
      {/* <a> y no <Link>: es una ruta API que redirige a Mercado Pago */}
      <a href={`/api/mercadopago/conectar?barberia=${slug}`}>{conexion ? "Volver a conectar" : "Conectar Mercado Pago"}</a>
    </Button>
  );

  return (
    <div className="space-y-4 text-sm">
      {aviso && (
        <p role="status" className={aviso.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
          {aviso.texto}
        </p>
      )}
      {conexion?.estado === "conectada" ? (
        <form action="/api/mercadopago/desconectar" method="post" className="space-y-2">
          <input type="hidden" name="barberia" value={slug} />
          <p>Conectado{conexion.cuenta ? <> como <span className="font-medium">{conexion.cuenta}</span></> : null}. Los pagos de tu tienda llegan directo a esa cuenta.</p>
          <Button type="submit" variant="outline">Desconectar</Button>
          <p className="text-xs text-muted-foreground">
            Para quitar también el acceso de Sunwalk, hazlo desde tu cuenta de Mercado Pago.
          </p>
        </form>
      ) : !configurado ? (
        <p className="text-muted-foreground">La conexión con Mercado Pago aún no está disponible en esta plataforma.</p>
      ) : (
        <>
          {conexion && (
            <p className="text-red-600 dark:text-red-400">
              La conexión se perdió{conexion.ultimo_error ? `: ${conexion.ultimo_error}` : "."} Tu tienda no puede cobrar hasta que la reconectes.
            </p>
          )}
          <p className="text-muted-foreground">
            Conecta tu cuenta de Mercado Pago para que los pagos de tu tienda lleguen directo a ti. Hasta entonces, la tienda se muestra como catálogo y no cobra.
          </p>
          {conectar}
        </>
      )}
    </div>
  );
}

/** Aviso para el admin en Productos y Pedidos cuando la tienda no puede cobrar. */
export function AvisoSinMercadoPago({ slug }: { slug: string }) {
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      Tu tienda no puede cobrar porque no tienes Mercado Pago conectado.{" "}
      <Link href={`/${slug}/dashboard/barberia`} className="font-medium underline underline-offset-4">Conectar Mercado Pago</Link>
    </div>
  );
}
