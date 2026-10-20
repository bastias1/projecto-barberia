import type { StaffContext } from "@/lib/staff-context";
import { toZoned } from "@/lib/datetime";

export function WelcomeHeader({ ctx }: { ctx: StaffContext }) {
  // Hora local de la barbería (el servidor corre en UTC)
  const currentHour = Number(toZoned(new Date()).hora.slice(0, 2));
  let greeting = "Buenos días";
  if (currentHour >= 12 && currentHour < 19) {
    greeting = "Buenas tardes";
  } else if (currentHour >= 19) {
    greeting = "Buenas noches";
  }

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {greeting}, {ctx.usuario.nombre}
      </h1>
      <p className="text-muted-foreground mt-1">
        Aquí tienes un resumen de tu actividad hoy
      </p>
    </div>
  );
}
