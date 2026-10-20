"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";

/** Nueva contraseña: desde "Mi cuenta" o desde el link de recuperación del correo. */
export default function CambiarClavePage() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  // Sin sesión no se puede cambiar (el link de recuperación crea una al entrar)
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login?next=/cuenta/clave");
      else setListo(true);
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
    const { error } = await createClient().auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) {
      toast.error(error.message.includes("different") ? "La nueva contraseña debe ser distinta a la actual" : "No se pudo cambiar la contraseña");
      return;
    }
    toast.success("Contraseña actualizada");
    router.push("/cuenta");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
      <div className="w-full max-w-md space-y-4">
        <Link href="/cuenta">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Mi cuenta</Button>
        </Link>
        <Card className="border-2 shadow-xl">
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
