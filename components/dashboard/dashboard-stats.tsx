import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, TrendingUp, Clock } from "lucide-react";

interface DashboardStatsProps {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  clientCount: number;
}

export function DashboardStats({ todayCount, weekCount, monthCount, clientCount }: DashboardStatsProps) {
  const stats = [
    {
      title: "Citas Hoy",
      value: todayCount,
      icon: Clock,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20"
    },
    {
      title: "Esta Semana",
      value: weekCount,
      icon: Calendar,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20"
    },
    {
      title: "Este Mes",
      value: monthCount,
      icon: TrendingUp,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20"
    },
    {
      title: "Total Clientes",
      value: clientCount,
      icon: Users,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {stat.title}
            </CardTitle>
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
