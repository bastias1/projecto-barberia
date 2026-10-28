import Link from "next/link";
import { ACCION_LABEL } from "@/lib/superadmin";
import { one } from "@/lib/utils";

export interface FilaBitacora {
  id: number;
  accion: string;
  entidad: string;
  id_entidad: string;
  detalle: Record<string, unknown> | null;
  created_at: string;
  usuario: unknown;
  // Nombre de la barbería / plan / usuario afectado, si se resolvió
  objetivo?: string | null;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

function enlace(fila: FilaBitacora): string {
  if (fila.entidad === "barberia") return `/admin/barberias/${fila.id_entidad}`;
  if (fila.entidad === "plan") return "/admin/planes";
  const email = (fila.detalle?.email as string | undefined) ?? "";
  return `/admin/usuarios${email ? `?q=${encodeURIComponent(email)}` : ""}`;
}

/** Resumen corto del cambio guardado en detalle (antes -> después). */
function resumen(fila: FilaBitacora): string | null {
  const d = fila.detalle ?? {};
  const despues = d.despues as Record<string, unknown> | undefined;
  if (fila.accion === "extender_vigencia" || fila.accion === "activar_cortesia") {
    return despues?.fecha_termino ? `hasta el ${despues.fecha_termino}` : "sin vencimiento";
  }
  if (fila.accion === "cambiar_plan" && despues?.plan) return `a ${despues.plan}`;
  if (fila.accion === "editar_plan" || fila.accion === "crear_plan") return `$${Number(d.precio ?? 0).toLocaleString("es-CL")}/mes`;
  return null;
}

/** Bitácora del panel: "Ayrton extendió la vigencia de Barberia-test · hasta el 2026-11-10". */
export function BitacoraLista({ filas, compacta = false }: { filas: FilaBitacora[]; compacta?: boolean }) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>;

  return (
    <ul className="space-y-3">
      {filas.map((f) => {
        const quien = one<{ nombre: string; apellido: string | null }>(f.usuario);
        const objetivo = f.objetivo ?? (f.detalle?.email as string | undefined) ?? (f.detalle?.nombre as string | undefined) ?? null;
        const extra = resumen(f);
        return (
          <li key={f.id} className="text-sm">
            <p>
              <span className="font-medium">{quien ? [quien.nombre, quien.apellido].filter(Boolean).join(" ") : "Alguien"}</span>{" "}
              {ACCION_LABEL[f.accion] ?? f.accion}
              {!compacta && objetivo && (
                <> <Link href={enlace(f)} className="font-medium hover:underline">{objetivo}</Link></>
              )}
              {extra && <span className="text-muted-foreground"> · {extra}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{fecha(f.created_at)}</p>
          </li>
        );
      })}
    </ul>
  );
}
