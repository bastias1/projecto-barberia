"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck, ShieldOff, UserCheck } from "lucide-react";
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
import { cambiarSuperadmin, cambiarSuspensionUsuario } from "@/app/admin/actions";

interface Props {
  idUsuario: string;
  email: string;
  superadmin: boolean;
  suspendido: boolean;
  esYo: boolean;
}

/** Rol de administrador de plataforma y suspensión de cuenta (con confirmación). */
export function UsuarioAcciones({ idUsuario, email, superadmin, suspendido, esYo }: Props) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);

  const ejecutar = async (accion: () => Promise<{ success: boolean; error?: string }>, exito: string) => {
    setEnCurso(true);
    try {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error ?? "No se pudo completar la acción");
        return;
      }
      toast.success(exito);
      router.refresh();
    } finally {
      setEnCurso(false);
    }
  };

  if (esYo) return <span className="text-xs text-muted-foreground">Tu cuenta</span>;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={enCurso} className="gap-1">
            {enCurso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : superadmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {superadmin ? "Quitar admin" : "Hacer admin"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{superadmin ? `¿Quitar el rol de administrador a ${email}?` : `¿Hacer administrador de la plataforma a ${email}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {superadmin
                ? "Dejará de tener acceso a este panel y a los dashboards de todas las barberías."
                : "Tendrá acceso a este panel y a los datos y dashboards de todas las barberías."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => ejecutar(() => cambiarSuperadmin({ idUsuario, superadmin: !superadmin }), superadmin ? "Rol quitado" : "Ahora es administrador de la plataforma")}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant={suspendido ? "default" : "ghost"} disabled={enCurso} className={suspendido ? "gap-1" : "gap-1 text-red-600"}>
            {suspendido ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            {suspendido ? "Reactivar" : "Suspender"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{suspendido ? `¿Reactivar la cuenta de ${email}?` : `¿Suspender la cuenta de ${email}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendido
                ? "Podrá volver a iniciar sesión."
                : "No podrá iniciar sesión hasta que la reactives. Sus reservas, pedidos y membresías se conservan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => ejecutar(() => cambiarSuspensionUsuario({ idUsuario, suspender: !suspendido }), suspendido ? "Cuenta reactivada" : "Cuenta suspendida")}>
              {suspendido ? "Reactivar" : "Suspender"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
