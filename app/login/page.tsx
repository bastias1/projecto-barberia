"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Scissors, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        
        // Check if user is a barber
        const { data: barberData, error: barberError } = await supabase
          .from('barbero')
          .select('*')
          .eq('id', data.user.id)
          .single();

        console.log("Barber check:", { barberData, barberError });

        if (barberError || !barberData) {
          setError("No tienes acceso al dashboard. Esta página es solo para barberos.");
          await supabase.auth.signOut();
          return;
        }

        // Redirect to dashboard
        router.push('/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4">
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

      <div className="w-full max-w-md">
        <Card className="border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Scissors className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold">
                Dashboard Barbero
              </CardTitle>
              <CardDescription className="text-sm mt-2">
                Inicia sesión para acceder al panel de control
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400 font-semibold mb-1">Error al iniciar sesión:</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  {error.includes("missing") && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-2">
                      Esto puede significar que no existe una cuenta con este correo. 
                      Por favor verifica que el correo esté registrado en el sistema.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="barbero@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base"
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

              <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 pt-2">
                <p>¿Olvidaste tu contraseña?</p>
                <button
                  type="button"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => toast.info("Contacta al administrador para recuperar tu contraseña")}
                >
                  Recuperar contraseña
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
