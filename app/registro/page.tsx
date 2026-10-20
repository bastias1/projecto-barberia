import Link from "next/link";
import { ArrowLeft, Scissors, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { RegistroForm } from "@/components/registro/registro-form";
import { createClient } from "@/utils/supabase/server";
import { getPlanes, DIAS_PRUEBA } from "@/lib/planes";
import { getMembresias } from "@/lib/roles";
import { PLATAFORMA } from "@/lib/plataforma";

export const dynamic = "force-dynamic";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [planes, membresias] = await Promise.all([
    getPlanes(supabase),
    user ? getMembresias(supabase, user.id) : Promise.resolve([]),
  ]);
  const administradas = membresias.filter((m) => m.rol === "admin");
  const next = encodeURIComponent(`/registro${plan ? `?plan=${plan}` : ""}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-8">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <div className="max-w-2xl mx-auto mb-6">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a {PLATAFORMA.nombre}
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center mb-4">
            <Scissors className="h-8 w-8 text-white dark:text-zinc-900" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Registra tu barbería</h1>
          <p className="text-muted-foreground">
            {DIAS_PRUEBA} días de prueba gratis. Después eliges si continúas.
          </p>
        </div>

        {administradas.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground">Ya administras:</p>
              {administradas.map((m) => (
                <Link key={m.slug} href={`/${m.slug}/dashboard`} className="flex items-center gap-2 font-medium hover:underline">
                  <Store className="h-4 w-4" />
                  {m.nombre}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {user ? (
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <CardTitle>Datos de tu barbería</CardTitle>
              <CardDescription>Podrás cambiar el logo, la descripción y agregar sucursales después.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegistroForm planes={planes} planInicial={Number(plan) || planes[0]?.id_plan} />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle>Primero, tu cuenta</CardTitle>
              <CardDescription>
                Con esta cuenta administrarás tu barbería. Si ya tienes una, inicia sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Link href={`/signup?next=${next}`} className="flex-1">
                <Button className="w-full h-11">Crear cuenta</Button>
              </Link>
              <Link href={`/login?next=${next}`} className="flex-1">
                <Button variant="outline" className="w-full h-11">Ya tengo cuenta</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
