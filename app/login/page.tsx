"use client"

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Scissors, Loader2, ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RECORDAR_COOKIE, RECORDAR_MAX_AGE } from "@/lib/sesion";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { destinoTrasLogin, esSuperadmin, getMembresias } from "@/lib/roles";
import { getBarberiaBySlug, type Barberia } from "@/lib/barberia";
import { safeNext } from "@/lib/utils";
import { PLATAFORMA } from "@/lib/plataforma";
import { toast } from "sonner";
import { ContinuarConGoogle } from "@/components/auth/continuar-con-google";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Login único de la plataforma. Desde una barbería llega con ?barberia=<slug>
 * (y opcionalmente ?next=<ruta>) para volver a ella al iniciar sesión.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("barberia");
  const next = safeNext(searchParams.get("next"));
  // Viene del link de confirmación abierto en otro navegador (ver /auth/callback)
  const confirmado = searchParams.get("confirmado") === "1";
  const [barberia, setBarberia] = useState<Barberia | null>(null);
  const [recordar, setRecordar] = useState(true);
  // Desde "correo ya registrado" en el registro llega el correo para no escribirlo de nuevo
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) getBarberiaBySlug(createClient(), slug).then(setBarberia);
  }, [slug]);

  // Con la sesión ya iniciada no tiene sentido el formulario: directo a su destino
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const [membresias, superadmin] = await Promise.all([getMembresias(supabase, user.id), esSuperadmin(supabase, user.id)]);
        router.replace(destinoTrasLogin(membresias, slug, next, superadmin));
      }
    });
  }, [router, slug, next]);

  // Recuperación: llega un correo con un link que abre /cuenta/clave con sesión
  const handleOlvideClave = async () => {
    const correo = email.trim();
    if (!correo) {
      toast.info("Escribe tu correo arriba y vuelve a presionar \"¿Olvidaste tu contraseña?\"");
      return;
    }
    const { error } = await createClient().auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/auth/callback?next=/cuenta/clave`,
    });
    if (error) {
      console.error("Reset password error:", error);
      toast.error("No se pudo enviar el correo de recuperación. Intenta más tarde.");
      return;
    }
    toast.success(`Si ${correo} tiene una cuenta, te enviamos un link para crear una nueva contraseña.`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // "Mantener sesión iniciada": los clientes de Supabase leen esta cookie al guardar la sesión
      document.cookie = recordar
        ? `${RECORDAR_COOKIE}=1; path=/; max-age=${RECORDAR_MAX_AGE}; samesite=lax`
        : `${RECORDAR_COOKIE}=0; path=/; samesite=lax`;

      const supabase = createClient();

      // Trim whitespace from email and password
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        setError("Por favor ingresa tu correo y contraseña");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        console.error("Supabase auth error:", error);

        // Check for specific error messages
        if (error.message.includes("Email not confirmed")) {
          setError("Por favor confirma tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.");
        } else if (error.message.includes("Invalid login credentials")) {
          setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
        } else {
          setError(error.message);
        }
        return;
      }

      if (data.user) {
        // Personal -> su dashboard; cliente -> la ruta pedida, su barbería o su cuenta
        const [membresias, superadmin] = await Promise.all([getMembresias(supabase, data.user.id), esSuperadmin(supabase, data.user.id)]);
        router.push(destinoTrasLogin(membresias, slug, next, superadmin));

        router.refresh();
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Error inesperado al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const nombre = barberia?.nombre ?? PLATAFORMA.nombre;
  const signupHref = `/signup?${new URLSearchParams({ ...(slug ? { barberia: slug } : {}), ...(next ? { next } : {}), ...(email.trim() ? { email: email.trim() } : {}) })}`;

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
      <header className="flex items-center justify-between p-4">
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link href={slug ? `/${slug}` : "/"}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <ModeToggle />
      </header>

      <main id="contenido" className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-6">
            {barberia?.logo_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
                <img src={barberia.logo_url} alt="" className={`h-14 max-w-40 object-contain ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`} />
                {barberia.logo_oscuro_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={barberia.logo_oscuro_url} alt="" className="h-14 max-w-40 object-contain hidden dark:block" />
                )}
              </>
            ) : (
              <span className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center">
                <Scissors className="h-5 w-5 text-white dark:text-zinc-900" aria-hidden="true" />
              </span>
            )}
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Inicia sesión</h1>
            <p className="text-sm text-muted-foreground">en {nombre}</p>
          </div>

          <Card className="p-6 gap-0 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              {confirmado && !error && (
                <div role="status" className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                  <MailCheck className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <p>Tu correo fue confirmado. Inicia sesión para continuar.</p>
                </div>
              )}
              {error && (
                <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={handleOlvideClave}
                    disabled={loading}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="recordar" checked={recordar} onCheckedChange={(v) => setRecordar(v === true)} disabled={loading} />
                <Label htmlFor="recordar" className="text-sm font-normal text-muted-foreground">Mantener sesión iniciada</Label>
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : "Iniciar sesión"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              o
              <span className="h-px flex-1 bg-border" />
            </div>

            <ContinuarConGoogle next={next} barberia={slug} />

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ¿No tienes cuenta?
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full h-11" asChild>
              <Link href={signupHref}>Crear cuenta</Link>
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
