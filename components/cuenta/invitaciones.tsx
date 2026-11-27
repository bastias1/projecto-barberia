import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponderInvitacion } from "@/components/cuenta/responder-invitacion";
import { ROL_LABEL } from "@/lib/roles";
import { formatFecha, toZoned } from "@/lib/datetime";
import type { getInvitaciones } from "@/lib/cuenta";

/** Invitaciones pendientes con aceptar / rechazar. Sin invitaciones no muestra nada. */
export function Invitaciones({ invitaciones }: { invitaciones: Awaited<ReturnType<typeof getInvitaciones>> }) {
  if (!invitaciones.length) return null;
  return (
    <Card className="border border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" aria-hidden="true" />Invitaciones</CardTitle>
        <CardDescription>Al aceptar, entras al equipo de la barbería.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitaciones.map((inv) => (
          <div key={inv.id_invitacion} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="font-semibold">{inv.barberia?.nombre}</p>
              <p className="text-sm text-muted-foreground">
                Como {ROL_LABEL[inv.rol as "admin" | "profesional"].toLowerCase()} · vence el{" "}
                {formatFecha(toZoned(inv.expira_at).fecha, "d 'de' MMMM")}
              </p>
            </div>
            <ResponderInvitacion token={inv.token} barberia={inv.barberia?.nombre ?? "la barbería"} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
