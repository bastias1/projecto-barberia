import { createClient } from "@/utils/supabase/server";
import { AppointmentsList } from "@/components/dashboard/appointments-list";
import { getAllAppointments } from "@/lib/services/dashboard-service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function CitasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const appointments = await getAllAppointments(user.id);

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
            Mis Citas
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Gestiona todas tus reservas
          </p>
        </div>
      </div>

      {/* Appointments List */}
      <AppointmentsList appointments={appointments} />
    </div>
  );
}
