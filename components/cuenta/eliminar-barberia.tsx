"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eliminarBarberia } from "@/app/cuenta/actions";

export function EliminarBarberia({ idBarberia, nombre }: { idBarberia: string; nombre: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const eliminar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEliminando(true);
    const result = await eliminarBarberia(idBarberia, confirmacion);
    setEliminando(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${nombre} fue eliminada`);
    setAbierto(false);
    router.refresh();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => { setAbierto(v); setConfirmacion(""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Eliminar ${nombre}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {nombre}</DialogTitle>
          <DialogDescription>
            Su página deja de existir, se cancela el cobro de la suscripción y las citas futuras (avisamos a los clientes), y tu equipo pierde el acceso. No se puede deshacer desde la aplicación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={eliminar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`confirmar-${idBarberia}`}>Escribe el nombre de la barbería para confirmar</Label>
            <Input id={`confirmar-${idBarberia}`} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" required />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={eliminando || confirmacion.trim() !== nombre.trim()}>
            {eliminando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar definitivamente
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
