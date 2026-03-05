import { createClient } from "@/utils/supabase/server";
import { getClientsWithStats, getMonthlyAttendanceStats } from "@/lib/services/dashboard-service";
import { ClientsList } from "@/components/dashboard/clients-list";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [clients, monthlyStats] = await Promise.all([
    getClientsWithStats(user.id),
    getMonthlyAttendanceStats(user.id),
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

      <ClientsList clients={clients} monthlyStats={monthlyStats} barberId={user.id} />
    </div>
  );
}
