import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeaderPlataforma } from "@/components/plataforma/header";
import { RegistroForm } from "@/components/registro/registro-form";
import { createClient } from "@/utils/supabase/server";
import { getPlanes, DIAS_PRUEBA } from "@/lib/planes";
import { resolverAcceso } from "@/lib/acceso";

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
    user ? resolverAcceso(supabase, user.id).then((a) => a.membresias) : Promise.resolve([]),
  ]);
  const administradas = membresias.filter((m) => m.rol === "admin");
  const next = encodeURIComponent(`/registro${plan ? `?plan=${plan}` : ""}`);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <HeaderPlataforma simple />
      <div className="p-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="display text-4xl sm:text-5xl mb-3">Registra tu barbería</h1>
          <p>
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
          <Card>
            <CardHeader>
              <CardTitle>Datos de tu barbería</CardTitle>
              <CardDescription>Podrás cambiar el logo, la descripción y agregar sucursales después.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegistroForm planes={planes} planInicial={Number(plan) || planes[0]?.id_plan} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Primero, tu cuenta</CardTitle>
              <CardDescription>
                Con esta cuenta administrarás tu barbería. Si ya tienes una, inicia sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="h-12 flex-1"><Link href={`/signup?next=${next}`}>Crear cuenta</Link></Button>
              <Button asChild variant="outline" className="h-12 flex-1 border border-border bg-transparent"><Link href={`/login?next=${next}`}>Ya tengo cuenta</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
