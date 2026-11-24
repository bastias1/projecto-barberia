"use client"

import { useState } from "react";
import { CalendarPlus, Gift, Power, Repeat, Trash2 } from "lucide-react";
import { useAccionAdmin } from "@/components/admin/use-accion-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { activarCortesia, cambiarEstadoBarberia, cambiarPlan, eliminarSuscripcion, extenderVigencia } from "@/app/admin/actions";
import { formatCLP } from "@/lib/datetime";

interface Props {
  idBarberia: string;
  nombre: string;
  activa: boolean;
  idPlan: number | null;
  fechaTermino: string | null;
  cobroAutomatico: boolean;
  /** Hay una suscripción que se pueda eliminar (no cancelada). */
  puedeEliminar: boolean;
  planes: { id_plan: number; nombre: string; precio: number; activo: boolean }[];
}

/** Acciones del superadmin sobre una barbería y su suscripción. */
export function BarberiaAcciones({ idBarberia, nombre, activa, idPlan, fechaTermino, cobroAutomatico, puedeEliminar, planes }: Props) {
  const { enCurso, ejecutar, cargando } = useAccionAdmin();
  const [fecha, setFecha] = useState(fechaTermino ?? "");
  const [plan, setPlan] = useState(idPlan ? String(idPlan) : "");
  const [fechaCortesia, setFechaCortesia] = useState("");

  return (
    <div className="space-y-6">
      {/* Vigencia */}
      <div className="space-y-2">
        <Label htmlFor="fecha-termino" className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" />Vigencia hasta</Label>
        <div className="flex gap-2">
          <Input id="fecha-termino" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="max-w-48" />
          <Button
            variant="outline"
            disabled={!fecha || enCurso !== null}
            onClick={() => ejecutar("vigencia", () => extenderVigencia({ idBarberia, fecha }), "Vigencia actualizada")}
            className="gap-2"
          >
            {cargando("vigencia")}Guardar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Extiende la prueba o la suscripción. Si estaba vencida, vuelve a quedar activa.</p>
      </div>

      {/* Plan */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Repeat className="h-4 w-4" />Plan</Label>
        <div className="flex gap-2">
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="max-w-64"><SelectValue placeholder="Elige un plan" /></SelectTrigger>
            <SelectContent>
              {planes.map((p) => (
                <SelectItem key={p.id_plan} value={String(p.id_plan)}>
                  {p.nombre} · {formatCLP(p.precio)}{p.activo ? "" : " (inactivo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!plan || plan === String(idPlan) || enCurso !== null}
            onClick={() => ejecutar("plan", () => cambiarPlan({ idBarberia, idPlan: Number(plan) }), "Plan cambiado")}
            className="gap-2"
          >
            {cargando("plan")}Cambiar
          </Button>
        </div>
        {cobroAutomatico && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Tiene cobro automático en Mercado Pago: el monto cobrado no cambia hasta que el dueño vuelva a pagar desde su Suscripción.
          </p>
        )}
      </div>

      {/* Cortesía */}
      <div className="space-y-2">
        <Label htmlFor="fecha-cortesia" className="flex items-center gap-2"><Gift className="h-4 w-4" />Activar como cortesía (sin cobro)</Label>
        <div className="flex gap-2">
          <Input id="fecha-cortesia" type="date" value={fechaCortesia} onChange={(e) => setFechaCortesia(e.target.value)} className="max-w-48" />
          <Button
            variant="outline"
            disabled={enCurso !== null || cobroAutomatico}
            onClick={() => ejecutar("cortesia", () => activarCortesia({ idBarberia, fecha: fechaCortesia || null }), "Activada como cortesía")}
            className="gap-2"
          >
            {cargando("cortesia")}Activar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {cobroAutomatico ? "No disponible: tiene cobro automático en Mercado Pago." : "Sin fecha queda activa indefinidamente."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {/* Eliminar suscripción */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={!puedeEliminar || enCurso !== null} className="gap-2 text-destructive">
              {cargando("eliminar") || <Trash2 className="h-4 w-4" />}
              Eliminar suscripción
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar la suscripción de {nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se cancela el cobro automático en Mercado Pago (si lo tiene) y la barbería pierde ahora el acceso a sus módulos.
                El historial de pagos se conserva y el dueño puede volver a suscribirse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => ejecutar("eliminar", () => eliminarSuscripcion({ idBarberia }), "Suscripción eliminada")}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Suspender */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={activa ? "destructive" : "default"} disabled={enCurso !== null} className="gap-2">
              {cargando("estado") || <Power className="h-4 w-4" />}
              {activa ? "Suspender barbería" : "Reactivar barbería"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{activa ? `¿Suspender ${nombre}?` : `¿Reactivar ${nombre}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {activa
                  ? "Su página pública, la reserva en línea y el dashboard quedan cerrados. Los datos se conservan y puedes reactivarla cuando quieras."
                  : "Su página, la reserva en línea y el dashboard vuelven a estar disponibles."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => ejecutar("estado", () => cambiarEstadoBarberia({ idBarberia, activa: !activa }), activa ? "Barbería suspendida" : "Barbería reactivada")}
              >
                {activa ? "Suspender" : "Reactivar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
