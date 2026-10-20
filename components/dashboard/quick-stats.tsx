import { getDashboardStats } from "@/lib/services/dashboard-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAT_ICONS, type StatItem } from "./stat-icons";
import { StatsCarousel } from "./stats-carousel";
import { formatCLP } from "@/lib/datetime";
import type { StaffContext } from "@/lib/staff-context";

export async function QuickStats({ ctx }: { ctx: StaffContext }) {
  const stats = await getDashboardStats(ctx.barberia.id_barberia, ctx.userId);

  const statsData: StatItem[] = [
    {
      title: "Citas Hoy",
      value: stats.todayCount,
      icon: "calendar",
      description: "Citas programadas",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Ingresos del Mes",
      value: formatCLP(stats.monthlyRevenue),
      icon: "dollar",
      description: "Citas completadas",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Total Clientes",
      value: stats.clientCount,
      icon: "users",
      description: "Clientes únicos",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Próxima Cita",
      value: stats.nextAppointmentTime || "--:--",
      icon: "clock",
      description: stats.nextAppointmentTime ? "Hoy" : "Sin citas",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <>
      {/* Móvil: una card deslizable */}
      <div className="md:hidden">
        <StatsCarousel stats={statsData} />
      </div>

      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat) => {
          const Icon = STAT_ICONS[stat.icon];
          return (
            <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
