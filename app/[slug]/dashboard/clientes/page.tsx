import { getClientsWithStats, getMonthlyAttendanceStats } from "@/lib/services/dashboard-service";
import { ClientsList } from "@/components/dashboard/clients-list";
import { requireStaff } from "@/lib/staff-context";

export default async function ClientesPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug);
  const idBarberia = ctx.barberia.id_barberia;

  const [clients, monthlyStats] = await Promise.all([
    getClientsWithStats(idBarberia, ctx.userId),
    getMonthlyAttendanceStats(idBarberia, ctx.userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Mis Clientes
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Historial y estadísticas de asistencia de tus clientes
        </p>
      </div>

      <ClientsList clients={clients} monthlyStats={monthlyStats} barberId={ctx.userId} />
    </div>
  );
}
