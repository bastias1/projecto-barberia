"use client"

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ModeToggle } from "@/components/mode-toggle";
import { Scissors, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getBarberiaBySlug } from "@/lib/barberia";
import { safeNext } from "@/lib/utils";
import { VERSION_POLITICA } from "@/lib/plataforma";
import { toast } from "sonner";
import { ContinuarConGoogle } from "@/components/auth/continuar-con-google";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

/**
 * Registro de clientes. Con ?barberia=<slug> la cuenta queda como cliente de
 * esa barbería; sin él (p. ej. quien va a registrar su barbería) solo se crea
 * el usuario.
 */
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("barberia");
  const next = safeNext(searchParams.get("next"));
  // Tras crear la cuenta: la ruta pedida, la barbería de origen o el inicio
  // Sin barbería de origen: a su cuenta (perfil, invitaciones y crear barbería)
  const destino = next ?? (slug ? `/${slug}` : "/cuenta");
  const loginHref = `/login?${new URLSearchParams({ ...(slug ? { barberia: slug } : {}), ...(next ? { next } : {}) })}`;
  const [formData, setFormData] = useState({
    // Desde una invitación llega el correo invitado
    email: searchParams.get("email") ?? "",
    password: "",
    confirmPassword: "",
    nombre: "",
    apellido: ""
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // HU-21: el correo ya tiene cuenta -> se ofrece iniciar sesión o recuperar la contraseña
  const [correoRegistrado, setCorreoRegistrado] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCorreoRegistrado(false);

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        setError("Las contraseñas no coinciden");
        setLoading(false);
        return;
      }

      // El trigger crear_perfil_usuario también lo exige (acepta_terminos en los metadatos)
      if (!aceptaTerminos) {
        setError("Debes aceptar los términos y la política de privacidad");
        setLoading(false);
        return;
      }

      if (formData.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Create auth user with email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?${new URLSearchParams({ next: destino, ...(slug ? { barberia: slug } : {}) })}`,
          data: {
            nombre: formData.nombre,
            apellido: formData.apellido,
            acepta_terminos: true,
            version_politica: VERSION_POLITICA,
          }
        }
      });

      if (authError) {
        console.error("Signup error:", authError);
        if (authError.message.includes("already registered")) {
          setCorreoRegistrado(true);
        } else if (authError.message.includes("Error sending confirmation email")) {
          setError("Error al enviar el correo de confirmación. Es posible que se haya alcanzado el límite de correos de prueba de Supabase. Por favor intenta más tarde o contacta al administrador.");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError("Error al crear la cuenta");
        return;
      }

      // Con confirmación de correo, Supabase no da error para un correo ya registrado:
      // devuelve un usuario sin identidades (y no envía el correo)
      if (authData.user.identities?.length === 0) {
        setCorreoRegistrado(true);
        return;
      }

      console.log("User created:", authData.user);
      console.log("Session:", authData.session);

      // Check if email confirmation is required
      if (!authData.session) {
        // Email confirmation is required - profiles will be created via callback
        toast.success("¡Cuenta creada exitosamente! Por favor revisa tu correo electrónico y haz clic en el enlace de confirmación para activar tu cuenta.");
        router.push(loginHref);
        return;
      }

      // If we have a session (no email confirmation required), create the profile now
      await new Promise(resolve => setTimeout(resolve, 1500));

      // El perfil en public.usuario lo crea el trigger crear_perfil_usuario
      const barberia = slug ? await getBarberiaBySlug(supabase, slug) : null;
      if (barberia) {
        const { error: membresiaError } = await supabase
          .from('usuario_barberia')
          .insert({
            id_usuario: authData.user.id,
            id_barberia: barberia.id_barberia,
            rol: 'cliente',
          });

        if (membresiaError) {
          console.error("Membership creation error:", membresiaError);
        }
      }

      toast.success("¡Cuenta creada exitosamente!");
      router.push(destino);
      router.refresh();
    } catch (error) {
      console.error("Signup error:", error);
      setError("Error inesperado al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4 py-8">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Link href={loginHref}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al Login</span>
            <span className="sm:hidden">Volver</span>
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md">
        <Card className="border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Scissors className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold">
                Crear Cuenta
              </CardTitle>
              <CardDescription className="text-sm mt-2">
                Regístrate para gestionar tus citas
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div role="alert" className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
              {correoRegistrado && (
                <div role="alert" className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-lg text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Ya existe una cuenta con {formData.email.trim()}.</p>
                  <p className="mt-1">
                    <Link
                      href={`/login?${new URLSearchParams({ ...(slug ? { barberia: slug } : {}), ...(next ? { next } : {}), email: formData.email.trim() })}`}
                      className="underline underline-offset-4 font-medium"
                    >
                      Inicia sesión
                    </Link>
                    {" "}o, si no recuerdas la contraseña, usa &quot;¿Olvidaste tu contraseña?&quot; en esa página.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Juan"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido (opcional)</Label>
                <Input
                  id="apellido"
                  type="text"
                  placeholder="Pérez"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="aceptaTerminos"
                  checked={aceptaTerminos}
                  onCheckedChange={(checked) => setAceptaTerminos(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <Label htmlFor="aceptaTerminos" className="text-sm font-normal leading-snug">
                  <span>
                    Acepto los{" "}
                    <Link href="/terminos" target="_blank" className="underline underline-offset-4">términos de servicio</Link>
                    {" "}y la{" "}
                    <Link href="/privacidad" target="_blank" className="underline underline-offset-4">política de privacidad</Link>
                  </span>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={loading || !aceptaTerminos}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear Cuenta"
                )}
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                o
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* Con Google los términos se aceptan después, en /cuenta/terminos */}
              <ContinuarConGoogle next={destino} barberia={slug} />

              <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 pt-2">
                <p>¿Ya tienes una cuenta?</p>
                <Link href={loginHref} className="text-blue-600 dark:text-blue-400 hover:underline">
                  Inicia sesión aquí
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
