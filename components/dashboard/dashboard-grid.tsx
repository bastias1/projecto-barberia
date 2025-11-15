"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, BarChart3, Settings, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const dashboardItems = [
  {
    title: "Resumen",
    description: "Estadísticas y actividad general",
    icon: BarChart3,
    href: "/dashboard/resumen",
    color: "from-blue-500 to-blue-600",
    bgColor: "hover:bg-blue-50 dark:hover:bg-blue-950/20",
    borderColor: "hover:border-blue-300 dark:hover:border-blue-800"
  },
  {
    title: "Citas",
    description: "Ver y gestionar reservas",
    icon: Calendar,
    href: "/dashboard/citas",
    color: "from-purple-500 to-purple-600",
    bgColor: "hover:bg-purple-50 dark:hover:bg-purple-950/20",
    borderColor: "hover:border-purple-300 dark:hover:border-purple-800"
  },
  {
    title: "Clientes",
    description: "Historial y gestión de clientes",
    icon: Users,
    href: "/dashboard/clientes",
    color: "from-green-500 to-green-600",
    bgColor: "hover:bg-green-50 dark:hover:bg-green-950/20",
    borderColor: "hover:border-green-300 dark:hover:border-green-800"
  },
  {
    title: "Horarios",
    description: "Configurar disponibilidad",
    icon: Clock,
    href: "/dashboard/horarios",
    color: "from-orange-500 to-orange-600",
    bgColor: "hover:bg-orange-50 dark:hover:bg-orange-950/20",
    borderColor: "hover:border-orange-300 dark:hover:border-orange-800"
  },
  {
    title: "Estadísticas",
    description: "Reportes y análisis detallados",
    icon: TrendingUp,
    href: "/dashboard/estadisticas",
    color: "from-pink-500 to-pink-600",
    bgColor: "hover:bg-pink-50 dark:hover:bg-pink-950/20",
    borderColor: "hover:border-pink-300 dark:hover:border-pink-800"
  },
  {
    title: "Configuración",
    description: "Ajustes de perfil y preferencias",
    icon: Settings,
    href: "/dashboard/configuracion",
    color: "from-zinc-500 to-zinc-600",
    bgColor: "hover:bg-zinc-50 dark:hover:bg-zinc-950/20",
    borderColor: "hover:border-zinc-300 dark:hover:border-zinc-800"
  }
];

export function DashboardGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {dashboardItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <Card className={cn(
            "border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full",
            item.borderColor
          )}>
            <CardHeader className="pb-3">
              <div className={cn(
                "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center mb-3",
                item.color
              )}>
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">{item.title}</CardTitle>
              <CardDescription className="text-sm">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click para acceder →
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
