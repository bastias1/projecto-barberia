"use client"

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { resolverAcceso } from "@/lib/acceso";
import { avisarCambioSeguridad } from "@/app/cuenta/actions";

export function ClaveForm({ tokenHash: tokenInicial, conSesion, pedirActual }: { tokenHash?: string; conSesion: boolean; pedirActual: boolean }) {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Link de recuperación: se canjea recién al guardar (los escáneres de correo abren los links)
  // y no depende del navegador donde se pidió
  const tokenHash = useRef(tokenInicial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (clave !== confirmacion) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setGuardando(true);
    const supabase = createClient();
    if (tokenHash.current) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash.current, type: "recovery" });
      if (error) {
        setGuardando(false);
        toast.error("El link venció o ya se usó. Pide uno nuevo con \"¿Olvidaste tu contraseña?\"");
        return;
      }
      // De un solo uso: un reintento o una recarga siguen con la sesión
      tokenHash.current = undefined;
      window.history.replaceState(null, "", "/cuenta/clave");
    }
    // La actual la comprueba Supabase (Authentication → "Require current password")
    const { data, error } = await supabase.auth.updateUser({ password: clave, ...(pedirActual && { current_password: actual }) });
    if (error) {
      setGuardando(false);
      toast.error(
        error.code === "same_password" ? "La nueva contraseña debe ser distinta a la actual"
          : error.code === "invalid_credentials" || /current.?password/i.test(error.message) ? "La contraseña actual no es correcta"
            : "No se pudo cambiar la contraseña",
      );
      return;
    }
    avisarCambioSeguridad("clave").catch(() => {});
    toast.success("Contraseña actualizada");
    // Personal -> su dashboard; si no, su cuenta
    router.push((await resolverAcceso(supabase, data.user.id)).destino);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md space-y-4">
        <Button asChild variant="ghost" className="gap-2">
          <Link href={conSesion ? "/cuenta" : "/login"}><ArrowLeft className="h-4 w-4" />{conSesion ? "Mi cuenta" : "Iniciar sesión"}</Link>
        </Button>
        <Card className="border shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Elige una contraseña de al menos 6 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {pedirActual && (
                <div className="space-y-2">
                  <Label htmlFor="actual">Contraseña actual</Label>
                  <Input id="actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} required autoComplete="current-password" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="clave">Nueva contraseña</Label>
                <Input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacion">Repite la contraseña</Label>
                <Input id="confirmacion" type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar contraseña
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
