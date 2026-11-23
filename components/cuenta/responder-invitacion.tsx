"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { avisarInvitacionAceptada } from "@/app/cuenta/actions";

/** Aceptar o rechazar una invitación (RPC responder_invitacion valida que sea para esta cuenta). */
export function ResponderInvitacion({ token, barberia }: { token: string; barberia: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<"aceptar" | "rechazar" | null>(null);

  const responder = async (aceptar: boolean) => {
    setEnviando(aceptar ? "aceptar" : "rechazar");
    const { data: slug, error } = await createClient().rpc("responder_invitacion", { p_token: token, p_aceptar: aceptar });
    setEnviando(null);

    if (error) {
      console.error("Error responding invitation:", error);
      toast.error(error.code === "P0001" || error.code === "23514" || error.code === "42501" ? error.message : "No se pudo responder la invitación");
      return;
    }
    if (aceptar) {
      avisarInvitacionAceptada(token).catch(() => {}); // el aviso al administrador no debe frenar la entrada
      toast.success(`¡Ya eres parte de ${barberia}!`);
      router.push(`/${slug}/dashboard`);
    } else {
      toast.success("Invitación rechazada");
      router.refresh();
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => responder(true)} disabled={enviando !== null} className="gap-1">
        {enviando === "aceptar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Aceptar
      </Button>
      <Button variant="outline" onClick={() => responder(false)} disabled={enviando !== null} className="gap-1">
        {enviando === "rechazar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        Rechazar
      </Button>
    </div>
  );
}
