import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { createClient } from "@/utils/supabase/server";
import { safeNext } from "@/lib/utils";
import { aceptarTerminos } from "./actions";

/** Primera entrada con Google: aceptar términos y privacidad antes de seguir (Ley 21.719). */
export default async function TerminosPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: nextParam, error } = await searchParams;
  const next = safeNext(nextParam) ?? "/cuenta";
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next })}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4">
      <main id="contenido" className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Antes de continuar</CardTitle>
            <CardDescription>Para usar tu cuenta ({user.email}) necesitamos que aceptes nuestras condiciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={aceptarTerminos} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div className="flex items-start gap-2">
                <Checkbox id="acepta" name="acepta" required className="mt-0.5" />
                <Label htmlFor="acepta" className="text-sm font-normal leading-snug">
                  <span>
                    Acepto los{" "}
                    <Link href="/terminos" target="_blank" className="underline underline-offset-4">términos de servicio</Link>
                    {" "}y la{" "}
                    <Link href="/privacidad" target="_blank" className="underline underline-offset-4">política de privacidad</Link>
                  </span>
                </Label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  Debes aceptar los términos y la política de privacidad para continuar.
                </p>
              )}
              <Button type="submit" className="w-full h-11">Continuar</Button>
            </form>
            <div className="mt-4 flex justify-center">
              <CerrarSesion redirigirA="/" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
