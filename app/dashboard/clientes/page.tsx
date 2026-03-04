import { createClient } from "@/utils/supabase/server";
import { getClientsWithStats, getMonthlyAttendanceStats } from "@/lib/services/dashboard-service";
import { ClientsList } from "@/components/dashboard/clients-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Mis Clientes
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Historial y estadísticas de asistencia de tus clientes
          </p>
        </div>
      </div>

      <ClientsList clients={clients} monthlyStats={monthlyStats} barberId={user.id} />
    </div>
  );
}
