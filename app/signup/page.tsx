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

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nombre: "",
    apellido: "",
    especialidad: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        setError("Las contraseñas no coinciden");
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
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          data: {
            nombre: formData.nombre,
            apellido: formData.apellido,
            especialidad: formData.especialidad,
            role: 'barbero'
          }
        }
      });

      if (authError) {
        console.error("Signup error:", authError);
        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError("Error al crear la cuenta");
        return;
      }

      console.log("User created:", authData.user);
      console.log("Session:", authData.session);

      // Check if email confirmation is required
      if (!authData.session) {
        // Email confirmation is required - profiles will be created via callback
        toast.success("¡Cuenta creada exitosamente! Por favor revisa tu correo electrónico y haz clic en el enlace de confirmación para activar tu cuenta.");
        router.push('/login');
        return;
      }

      // If we have a session (no email confirmation required), create the profiles now
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 1: Create usuario record first (required by barbero foreign key)
      const { error: usuarioError } = await supabase
        .from('usuario')
        .insert({
          id: authData.user.id,
          nombre: formData.nombre,
          apellido: formData.apellido || '',
          correo: formData.email.trim(),
          telefono: '',
          rol: 'barbero'
        });

      if (usuarioError) {
        console.error("Usuario creation error:", usuarioError);
        setError("Error al crear el usuario: " + usuarioError.message);
        await supabase.auth.signOut();
        return;
      }

      console.log("Usuario created successfully");

      // Step 2: Create barber record (references usuario)
      const { error: barberError } = await supabase
        .from('barbero')
        .insert({
          id: authData.user.id,
          nombre: formData.nombre,
          apellido: formData.apellido || '',
          especialidad: formData.especialidad || null
        });

      if (barberError) {
        console.error("Barber creation error:", barberError);
        // Try to clean up the usuario record
        await supabase.from('usuario').delete().eq('id', authData.user.id);
        await supabase.auth.signOut();
        setError("Error al crear el perfil de barbero: " + barberError.message);
        return;
      }

      // Success - redirect to dashboard or login
      toast.success("Cuenta creada exitosamente! Ya puedes iniciar sesión.");
      router.push('/login');
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
        <Link href="/login">
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
                Crear Cuenta Barbero
              </CardTitle>
              <CardDescription className="text-sm mt-2">
                Registra tu cuenta para acceder al dashboard
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Juan"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  type="text"
                  placeholder="Pérez"
                  value={formData.apellido}
                  onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="especialidad">Especialidad (Opcional)</Label>
                <Input
                  id="especialidad"
                  type="text"
                  placeholder="Cortes clásicos, Barbas, etc."
                  value={formData.especialidad}
                  onChange={(e) => setFormData({...formData, especialidad: e.target.value})}
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="barbero@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
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
                    Creando cuenta...
                  </>
                ) : (
                  "Crear Cuenta"
                )}
              </Button>

              <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 pt-2">
                <p>¿Ya tienes una cuenta?</p>
                <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
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
