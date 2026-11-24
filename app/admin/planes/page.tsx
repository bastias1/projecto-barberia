import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanEditor } from "@/components/admin/plan-editor";
import { PlanAcciones } from "@/components/admin/plan-acciones";import { createClient } from "@/utils/supabase/server";
import { caracteristicasPlan, getPlanes } from "@/lib/planes";
import { getBarberiasAdmin } from "@/lib/admin-datos";
import { formatCLP } from "@/lib/datetime";

export default async function AdminPlanes() {
  const supabase = await createClient();
  const [planes, barberias] = await Promise.all([getPlanes(supabase, { incluirInactivos: true }), getBarberiasAdmin(supabase)]);

  // Barberías vigentes (no suspendidas ni vencidas) por plan
  const usoPorPlan = new Map<number, number>();
  for (const b of barberias) {
    if (!b.suscripcion || ["vencida", "suspendida", "sin"].includes(b.estado.clave)) continue;
    usoPorPlan.set(b.suscripcion.id_plan, (usoPorPlan.get(b.suscripcion.id_plan) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Planes y precios</h1>
          <p className="text-muted-foreground">Lo que ven las barberías en la portada y al pagar su suscripción.</p>
        </div>
        <PlanEditor plan={null} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {planes.map((p) => (
          <Card key={p.id_plan} className={p.activo ? "" : "opacity-70 border-dashed"}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  {p.nombre}
                  {!p.activo && <Badge variant="outline">Inactivo</Badge>}
                </CardTitle>
                <CardDescription>{p.descripcion}</CardDescription>
              </div>
              <PlanEditor plan={p} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-black">{formatCLP(p.precio_mensual)}</span>
                <span className="text-muted-foreground"> /mes</span>
              </div>
              <ul className="space-y-1.5">
                {caracteristicasPlan(p).map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground border-t pt-3">
                {usoPorPlan.get(p.id_plan) ?? 0} barberías vigentes en este plan
              </p>
              <PlanAcciones idPlan={p.id_plan} nombre={p.nombre} activo={p.activo} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
