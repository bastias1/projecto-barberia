"use client"

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [email, setEmail] = useState("");
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

  return (
    <div className="min-h-dvh bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4 md:p-8">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Link href={slug ? `/${slug}` : "/"}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-4xl">
        <Card className="border-2 shadow-2xl overflow-hidden p-0">
          <div className="grid md:grid-cols-2">

            {/* Left Side: Login Form */}
            <div className="p-8 md:p-12 bg-white dark:bg-zinc-950">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Bienvenido</h1>
                <p className="text-muted-foreground">Inicia sesión en tu cuenta</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {confirmado && !error && (
                  <div className="p-3 flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300">
                    <MailCheck className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>Tu correo fue confirmado. Inicia sesión para continuar.</p>
                  </div>
                )}
                {error && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400 font-semibold mb-1">Error al iniciar sesión:</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-zinc-500" />
                      )}
                    </Button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                  <Checkbox checked={recordar} onCheckedChange={(v) => setRecordar(v === true)} disabled={loading} />
                  Mantener sesión iniciada
                </label>

                <Button
                  type="submit"
                  className="w-full h-11 text-base mt-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline"
                    onClick={handleOlvideClave}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side: Sign Up Call to Action */}
            <div className="p-8 md:p-12 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center text-center border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800">
              <div className="w-32 h-32 mb-6 relative flex items-center justify-center">
                {barberia?.logo_url ? (
                  <>
                    <img
                      src={barberia.logo_url}
                      alt={`Logo ${barberia.nombre}`}
                      className={`max-h-full object-contain ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
                    />
                    {barberia.logo_oscuro_url && (
                      <img src={barberia.logo_oscuro_url} alt={`Logo ${barberia.nombre}`} className="max-h-full object-contain hidden dark:block" />
                    )}
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                    <Scissors className="h-10 w-10 text-white dark:text-zinc-900" />
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold mb-4">¿Eres nuevo aquí?</h2>
              <p className="text-muted-foreground mb-8 max-w-xs">
                {barberia
                  ? `Regístrate en ${barberia.nombre} para agendar tus citas, comprar productos y gestionar tu perfil.`
                  : `Crea tu cuenta en ${PLATAFORMA.nombre} para registrar tu barbería o reservar en una.`}
              </p>

              <Link href={`/signup?${new URLSearchParams({ ...(slug ? { barberia: slug } : {}), ...(next ? { next } : {}) })}`} className="w-full max-w-xs">
                <Button variant="outline" className="w-full h-11 text-base border-2 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                  Crear Cuenta
                </Button>
              </Link>
            </div>

          </div>
        </Card>
      </div>
    </div>
  );
}
