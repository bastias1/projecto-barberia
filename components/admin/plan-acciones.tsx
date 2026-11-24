"use client"

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAccionAdmin } from "@/components/admin/use-accion-admin";
import { archivarPlan, eliminarPlan } from "@/app/admin/actions";

/** Archivar/reactivar y eliminar un plan. */
export function PlanAcciones({ idPlan, nombre, activo }: { idPlan: number; nombre: string; activo: boolean }) {
  const { enCurso, ejecutar, cargando } = useAccionAdmin();

  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      {activo ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={enCurso !== null} className="gap-1">
              {cargando("archivar") || <Archive className="h-3.5 w-3.5" />}Archivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Archivar el plan {nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                Deja de mostrarse en la portada y en Suscripción. Las barberías que ya lo tienen lo conservan con su precio pactado. Puedes reactivarlo cuando quieras.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => ejecutar("archivar", () => archivarPlan({ idPlan, activo: false }), "Plan archivado")}>Archivar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={enCurso !== null}
          onClick={() => ejecutar("archivar", () => archivarPlan({ idPlan, activo: true }), "Plan reactivado")}
          className="gap-1"
        >
          {cargando("archivar") || <ArchiveRestore className="h-3.5 w-3.5" />}Reactivar
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={enCurso !== null} className="gap-1 text-destructive">
            {cargando("eliminar") || <Trash2 className="h-3.5 w-3.5" />}Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el plan {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra para siempre. Si alguna suscripción lo usó alguna vez (aunque sea antigua) no se puede eliminar: en ese caso archívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => ejecutar("eliminar", () => eliminarPlan({ idPlan }), "Plan eliminado")}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
