import { Button } from "@/components/ui/button";

export interface VinculoGoogle {
  email_google: string;
  ultimo_error: string | null;
}

const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  ok: { texto: "Google Calendar quedó conectado. Tus reservas aparecerán en tu calendario en unos minutos." },
  desconectado: { texto: "Google Calendar quedó desconectado." },
  error: { texto: "No se pudo completar la acción con Google Calendar. Intenta nuevamente.", error: true },
  "no-configurado": { texto: "La conexión con Google Calendar aún no está disponible.", error: true },
};

/** HU-24: conectar / desconectar el Google Calendar del barbero (contenido de la tarjeta de Configuración). */
export function GoogleCalendarConexion({ slug, vinculo, configurado, resultado }: {
  slug: string;
  vinculo: VinculoGoogle | null;
  configurado: boolean;
  resultado?: string;
}) {
  const aviso = resultado ? AVISOS[resultado] : undefined;
  return (
    <div className="space-y-4 text-sm">
      {aviso && (
        <p role="status" className={aviso.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
          {aviso.texto}
        </p>
      )}
      {vinculo ? (
        <>
          <p>Conectado como <span className="font-medium">{vinculo.email_google}</span>.</p>
          {vinculo.ultimo_error && (
            <p className="text-red-600 dark:text-red-400">Último error al sincronizar: {vinculo.ultimo_error}</p>
          )}
          <form action="/api/google-calendar/desconectar" method="post" className="space-y-2">
            <input type="hidden" name="barberia" value={slug} />
            <Button type="submit" variant="outline">Desconectar</Button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Los eventos ya creados se quedan en tu calendario.</p>
          </form>
        </>
      ) : configurado ? (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            Tus reservas activas se agregan a tu Google Calendar y se actualizan si cambian o se cancelan.
          </p>
          <Button asChild>
            {/* <a> y no <Link>: es una ruta API que redirige a Google */}
            <a href={`/api/google-calendar/conectar?barberia=${slug}`}>Conectar Google Calendar</a>
          </Button>
        </>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">La conexión con Google Calendar aún no está disponible en esta plataforma.</p>
      )}
    </div>
  );
}
