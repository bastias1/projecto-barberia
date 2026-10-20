import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { requireStaff } from "@/lib/staff-context";
import { countCitasPorAtenderHoy } from "@/lib/services/dashboard-service";
import { ReservasRealtime } from "@/components/dashboard/reservas-realtime";
import { getModulosCached } from "@/lib/barberia-server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  // Solo el personal de la barbería (admin o barbero) entra al dashboard.
  // Los barberos llegan por invitación del administrador (Equipo).
  const ctx = await requireStaff((await params).slug);
  // Sin el módulo base la suscripción no está vigente: la agenda pública queda cerrada
  const vigente = (await getModulosCached(ctx.barberia.id_barberia)).includes("agenda");
  // Solo quien tiene agenda propia tiene citas que contar y avisos de reservas
  const citasHoy = ctx.isProfesional ? await countCitasPorAtenderHoy(ctx.barberia.id_barberia, ctx.userId) : 0;

  const barber = {
    id: ctx.userId,
    nombre: ctx.profesional?.alias || ctx.usuario.nombre,
    especialidad: ctx.profesional?.especialidad ?? null,
    usuario: { profile_image: ctx.usuario.profile_image },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
      {/* Main Layout with Sidebar */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <DashboardSidebar barber={barber} rol={ctx.rol} barberiaNombre={ctx.barberia.nombre} citasHoy={citasHoy} />
        {ctx.isProfesional && <ReservasRealtime profesionalId={ctx.userId} />}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 md:p-6 lg:p-8">
          {!vigente && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p>
                La suscripción de {ctx.barberia.nombre} no está vigente: los clientes no pueden reservar en línea.{" "}
                {ctx.isAdmin ? (
                  <Link href={`/${ctx.barberia.slug}/dashboard/suscripcion`} className="font-semibold underline underline-offset-4">
                    Renovar suscripción
                  </Link>
                ) : (
                  "Avísale al administrador."
                )}
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
