import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First check if user is a cliente - redirect them to their profile
  const { data: usuarioData } = await supabase
    .from('usuario')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (usuarioData?.rol === 'cliente') {
    redirect("/profile");
  }

  // Verify user is a barber
  const { data: barberData, error } = await supabase
    .from('barbero')
    .select('*, usuario!inner(profile_image)')
    .eq('id', user.id)
    .single();

  // If barber profile doesn't exist, try to create it (along with usuario if needed)
  if (error || !barberData) {
    const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Barbero';
    const especialidad = user.user_metadata?.especialidad || null;

    // First, check if usuario exists, if not create it
    const { data: usuarioData, error: usuarioCheckError } = await supabase
      .from('usuario')
      .select('*')
      .eq('id', user.id)
      .single();

    if (usuarioCheckError || !usuarioData) {
      // Create usuario record first
      const { error: usuarioCreateError } = await supabase
        .from('usuario')
        .insert({
          id: user.id,
          nombre: nombre,
          apellido: '',
          correo: user.email || '',
          telefono: '',
          rol: 'barbero'
        });

      if (usuarioCreateError) {
        console.error("Error creating usuario:", usuarioCreateError);
        redirect("/login");
      }
    }

    // Now create barber profile
    const { data: newBarber, error: createError } = await supabase
      .from('barbero')
      .insert({
        id: user.id,
        nombre: nombre,
        apellido: '',
        especialidad: especialidad
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating barber profile:", createError);
      redirect("/login");
    }

    // Use the newly created barber data
    const finalBarberData = newBarber || { id: user.id, nombre, apellido: '', especialidad };

    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
        <div className="flex h-screen overflow-hidden">
          <DashboardSidebar barber={finalBarberData} />
          <main className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
      {/* Main Layout with Sidebar */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <DashboardSidebar barber={barberData} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
