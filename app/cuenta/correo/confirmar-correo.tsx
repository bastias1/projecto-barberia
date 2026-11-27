"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";

type Estado = "pendiente" | "listo" | "falta_otro" | "error";

const TEXTOS: Record<Estado, string> = {
  pendiente: "Confirma para aplicar el cambio de correo de tu cuenta.",
  listo: "Tu correo quedó actualizado.",
  falta_otro: "Confirmación recibida. Falta confirmar desde el link que enviamos a tu otro correo.",
  error: "El link venció o ya se usó. Pide el cambio de nuevo en Mi cuenta.",
};

/** Se canjea al apretar el botón: los escáneres de correo abren los links. */
export function ConfirmarCorreo({ tokenHash }: { tokenHash?: string }) {
  const [estado, setEstado] = useState<Estado>("pendiente");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!tokenHash) return;
    setEnviando(true);
    const { data, error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: "email_change" });
    setEnviando(false);
    // Con confirmación en ambos correos, el primer link no devuelve sesión
    setEstado(error ? "error" : data.session ? "listo" : "falta_otro");
  };

  return (
    <main id="contenido" className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-8 w-8" aria-hidden="true" />
          <CardTitle>Cambio de correo</CardTitle>
          <CardDescription role="status">
            {tokenHash ? TEXTOS[estado] : "Revisa en Mi cuenta qué correo quedó activo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokenHash && estado === "pendiente" && (
            <Button className="w-full" onClick={confirmar} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar el cambio
            </Button>
          )}
          <Button asChild variant="outline" className="w-full"><Link href="/cuenta">Ir a Mi cuenta</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
