import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, User, Lock, Image } from "lucide-react";
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
    <div className="space-y-4 md:space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 md:gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Configuración
          </h1>
          <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
            Gestiona tu perfil y preferencias
          </p>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid gap-6 md:grid-cols-2">
        {/* Row 1: Profile Image & Password */}
        <Card className="md:col-span-1 h-full">
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>Actualiza tu imagen de perfil</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <AvatarUpload
              userId={user.id}
              currentImage={profile?.profile_image}
              userName={profile?.nombre || 'Usuario'}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-1 h-full">
          <CardHeader>
            <CardTitle>Cambiar Contraseña</CardTitle>
            <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        {/* Row 2: Personal Info (Full Width) */}
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
      </div>

      {/* Mobile Layout - Accordion */}
      <Accordion type="single" collapsible className="md:hidden space-y-2">
        <AccordionItem value="avatar" className="border rounded-lg bg-white dark:bg-zinc-900">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Image className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Foto de Perfil</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Actualiza tu imagen</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <AvatarUpload
              userId={user.id}
              currentImage={profile?.profile_image}
              userName={profile?.nombre || 'Usuario'}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="profile" className="border rounded-lg bg-white dark:bg-zinc-900">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Información Personal</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Datos de contacto</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="password" className="border rounded-lg bg-white dark:bg-zinc-900">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Cambiar Contraseña</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Seguridad de cuenta</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <PasswordForm />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
