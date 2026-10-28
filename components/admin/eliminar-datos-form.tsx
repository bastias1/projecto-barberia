"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { eliminarDatosPersona } from "@/app/admin/actions";

/** Ejecuta una solicitud de /eliminar-datos ya verificada (cuenta y registros como invitado con ese correo). */
export function EliminarDatosForm() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [enCurso, setEnCurso] = useState(false);

  const eliminar = async () => {
    setEnCurso(true);
    try {
      const r = await eliminarDatosPersona({ correo });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Datos eliminados");
      setCorreo("");
      router.refresh();
    } finally {
      setEnCurso(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Eliminar datos de una persona</CardTitle>
        <CardDescription>
          Usa esto solo después de verificar la solicitud desde ese mismo correo. Anonimiza su cuenta y sus reservas como
          invitado en todas las barberías; las transacciones se conservan sin datos personales. No se puede deshacer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="correo-eliminar">Correo de la solicitud</Label>
            <Input
              id="correo-eliminar"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="persona@correo.com"
              disabled={enCurso}
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={enCurso || !correo.trim()} className="gap-1">
                {enCurso ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                Eliminar datos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar los datos de {correo.trim()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borran su nombre, correo, teléfono, foto, direcciones, comentarios y notas, se cancelan sus reservas
                  futuras y ya no podrá iniciar sesión. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={eliminar}>Eliminar datos</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
