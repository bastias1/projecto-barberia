import { createClient } from "@/utils/supabase/server";
import { getBarberInfo } from "@/lib/services/dashboard-service";

export async function WelcomeHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const barberInfo = await getBarberInfo(user.id);

  if (!barberInfo) {
    return null;
  }

  const currentHour = new Date().getHours();
  let greeting = "Buenos días";
  if (currentHour >= 12 && currentHour < 19) {
    greeting = "Buenas tardes";
  } else if (currentHour >= 19) {
    greeting = "Buenas noches";
  }

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {greeting}, {barberInfo.nombre}
      </h1>
      <p className="text-muted-foreground mt-1">
        Aquí tienes un resumen de tu actividad hoy
      </p>
    </div>
  );
}
