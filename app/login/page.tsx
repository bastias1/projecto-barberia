"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Scissors, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log("Attempting login with email:", email);

    try {
      const supabase = createClient();

      // Trim whitespace from email and password
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      console.log("Trimmed email:", trimmedEmail);

      if (!trimmedEmail || !trimmedPassword) {
        setError("Por favor ingresa tu correo y contraseña");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      console.log("Login response:", { data, error });

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
        console.log("User authenticated:", data.user.id);

        // Check user role in 'usuario' table
        const { data: userData, error: userError } = await supabase
          .from('usuario')
          .select('rol')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          console.error("Error fetching user role:", userError);
          // Fallback or default behavior
          router.push('/');
          router.refresh();
          return;
        }

        const role = userData?.rol;
        console.log("User role:", role);

        if (role === 'admin' || role === 'owner' || role === 'barbero') {
          router.push('/dashboard');
        } else {
          // Default for clients or others
          router.push('/tienda');
        }

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
        <Link href="/">
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
                    onClick={() => toast.info("Contacta al administrador para recuperar tu contraseña")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side: Sign Up Call to Action */}
            <div className="p-8 md:p-12 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center text-center border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800">
              <div className="w-32 h-32 mb-6 relative flex items-center justify-center">
                <Image
                  src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/design.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              <h2 className="text-2xl font-bold mb-4">¿Eres nuevo aquí?</h2>
              <p className="text-muted-foreground mb-8 max-w-xs">
                Regístrate para agendar tus citas, comprar productos exclusivos y gestionar tu perfil.
              </p>

              <Link href="/signup" className="w-full max-w-xs">
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
