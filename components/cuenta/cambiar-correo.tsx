"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { avisarCambioSeguridad } from "@/app/cuenta/actions";

/** Pide el cambio de correo: Supabase manda el link de confirmación y recién ahí cambia. */
export function CambiarCorreo({ actual }: { actual: string }) {
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // el diálogo va en un portal, pero el evento sube al formulario del perfil
    const nuevo = correo.trim().toLowerCase();
    if (nuevo === actual.toLowerCase()) return toast.error("Ese ya es tu correo");
    setEnviando(true);
    const { error } = await createClient().auth.updateUser(
      { email: nuevo },
      { emailRedirectTo: `${window.location.origin}/cuenta/correo` },
    );
    setEnviando(false);
    if (error) {
      return toast.error(
        error.code === "email_exists" ? "Ya existe una cuenta con ese correo"
          : error.code === "over_email_send_rate_limit" ? "Espera un momento antes de volver a pedirlo"
            : "No se pudo pedir el cambio de correo",
      );
    }
    avisarCambioSeguridad("correo", nuevo).catch(() => {});
    toast.success("Te enviamos un correo para confirmar el cambio");
    setAbierto(false);
    setCorreo("");
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Cambiar correo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar correo</DialogTitle>
          <DialogDescription>
            El cambio se aplica cuando lo confirmes desde el correo que te enviaremos. Las reservas hechas como invitado con tu correo anterior dejan de aparecer en tu historial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correo-nuevo">Nuevo correo</Label>
            <Input id="correo-nuevo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" />
          </div>
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar confirmación
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
