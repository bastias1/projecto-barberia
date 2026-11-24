"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { archivarPlan, eliminarPlan } from "@/app/admin/actions";

interface Props {
  idPlan: number;
  nombre: string;
  activo: boolean;
  /** Suscripciones que alguna vez usaron el plan: con alguna, solo se puede archivar. */
  enUso: number;
}

/** Archivar/reactivar y eliminar un plan. */
export function PlanAcciones({ idPlan, nombre, activo, enUso }: Props) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState<"archivar" | "eliminar" | null>(null);

  const ejecutar = async (clave: "archivar" | "eliminar", accion: () => Promise<{ success: true } | { success: false; error: string }>, exito: string) => {
    setEnCurso(clave);
    try {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(exito);
      router.refresh();
    } finally {
      setEnCurso(null);
    }
  };

  const cargando = (clave: string) => enCurso === clave && <Loader2 className="h-4 w-4 animate-spin" />;

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
          <Button variant="outline" size="sm" disabled={enCurso !== null || enUso > 0} className="gap-1 text-destructive">
            {cargando("eliminar") || <Trash2 className="h-3.5 w-3.5" />}Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el plan {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>Se borra para siempre. No tiene suscripciones asociadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => ejecutar("eliminar", () => eliminarPlan({ idPlan }), "Plan eliminado")}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {enUso > 0 && (
        <p className="w-full text-xs text-muted-foreground">
          No se puede eliminar: {enUso} {enUso === 1 ? "suscripción lo usó" : "suscripciones lo usaron"}. Archívalo para ocultarlo.
        </p>
      )}
    </div>
  );
}
