import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordForm } from "@/components/dashboard/password-form";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/login');
  }

  // Get user profile data
  const { data: profile } = await supabase
    .from('usuario')
    .select('nombre, apellido, correo, telefono, profile_image, rol')
    .eq('id', user.id)
    .single();

  // Check if user is a barber to get additional data
  let barberData = null;
  if (profile?.rol === 'barbero') {
    const { data } = await supabase
      .from('barbero')
      .select('especialidad')
      .eq('id', user.id)
      .single();
    barberData = data;
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Configuración
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Gestiona tu perfil y preferencias
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Avatar Upload */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>Actualiza tu imagen de perfil</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload 
              userId={user.id} 
              currentImage={profile?.profile_image} 
              userName={profile?.nombre || 'Usuario'}
            />
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>Actualiza tus datos personales</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm 
              userId={user.id}
              initialData={{
                nombre: profile?.nombre || '',
                apellido: profile?.apellido || '',
                telefono: profile?.telefono || '',
                correo: profile?.correo || user.email || '',
                especialidad: barberData?.especialidad || '',
                rol: profile?.rol || '',
              }}
            />
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cambiar Contraseña</CardTitle>
            <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
