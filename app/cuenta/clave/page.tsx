"use client"

import { useEffect, useRef, useState } from "react";
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

/** Nueva contraseña: desde "Mi cuenta" o desde el link de recuperación del correo. */
export default function CambiarClavePage() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  // Link de recuperación: se canjea recién al guardar (los escáneres de correo abren los links)
  // y no depende del navegador donde se pidió
  const tokenHash = useRef<string | null>(null);

  // Sin sesión ni link de recuperación no se puede cambiar
  useEffect(() => {
    tokenHash.current = new URLSearchParams(window.location.search).get("token_hash");
    const puede = tokenHash.current
      ? Promise.resolve(true)
      : createClient().auth.getUser().then(({ data: { user } }) => !!user);
    puede.then((ok) => {
      if (ok) setListo(true);
      else router.replace("/login?next=/cuenta/clave");
    });
  }, [router]);

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
      tokenHash.current = null; // de un solo uso: un reintento ya tiene sesión
    }
    const { data, error } = await supabase.auth.updateUser({ password: clave });
    if (error) {
      setGuardando(false);
      toast.error(error.message.includes("different") ? "La nueva contraseña debe ser distinta a la actual" : "No se pudo cambiar la contraseña");
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
        <Link href="/cuenta">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Mi cuenta</Button>
        </Link>
        <Card className="border shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Elige una contraseña de al menos 6 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            {!listo ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
