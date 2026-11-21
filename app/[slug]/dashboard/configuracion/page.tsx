import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Lock, Image, CalendarDays } from "lucide-react";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordForm } from "@/components/dashboard/password-form";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { GoogleCalendarConexion } from "@/components/dashboard/google-calendar";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { googleConfigurado } from "@/lib/google-calendar-oauth";
import { createClient } from "@/utils/supabase/server";

export default async function ConfiguracionPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ calendario?: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireStaff(slug);

  // HU-24: solo quien tiene agenda y con el módulo `calendario` en vigencia
  const conCalendario = ctx.isProfesional && (await getModulosCached(ctx.barberia.id_barberia)).includes("calendario");
  const vinculo = conCalendario
    ? (await (await createClient()).from("calendario_google").select("email_google, ultimo_error")
      .eq("id_usuario", ctx.userId).maybeSingle()).data
    : null;
  const calendario = conCalendario && (
    <GoogleCalendarConexion slug={slug} vinculo={vinculo} configurado={googleConfigurado()}
      resultado={(await searchParams).calendario} />
  );

  const user = { id: ctx.userId, email: ctx.email };
  const profile = ctx.usuario;
  const profileFormProps = {
    userId: ctx.userId,
    barberiaId: ctx.barberia.id_barberia,
    isProfesional: ctx.profesional !== null,
    initialData: {
      nombre: profile.nombre || '',
      apellido: profile.apellido || '',
      telefono: profile.telefono || '',
      correo: profile.email || ctx.email,
      especialidad: ctx.profesional?.especialidad || '',
    },
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Configuración
        </h1>
        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
          Gestiona tu perfil y preferencias
        </p>
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
            <ProfileForm {...profileFormProps} />
          </CardContent>
        </Card>

        {calendario && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Google Calendar</CardTitle>
              <CardDescription>Sincroniza tus reservas con tu calendario</CardDescription>
            </CardHeader>
            <CardContent>{calendario}</CardContent>
          </Card>
        )}
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
            <ProfileForm {...profileFormProps} />
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

        {calendario && (
          <AccordionItem value="calendario" className="border rounded-lg bg-white dark:bg-zinc-900">
            <AccordionTrigger className="hover:no-underline px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Google Calendar</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Sincroniza tus reservas</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">{calendario}</AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
