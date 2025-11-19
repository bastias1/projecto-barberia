"use client"

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Scissors, Calendar, Users, BarChart3, Settings, LogOut, Menu, X, Clock, TrendingUp, Home, UserPlus, Package } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";

interface Barbero {
  id: string;
  nombre: string | null;
  especialidad: string | null;
  usuario?: {
    profile_image?: string | null;
  };
}

interface DashboardSidebarProps {
  barber: Barbero;
}

const navItems = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/dashboard/resumen", icon: BarChart3, label: "Resumen" },
  { href: "/dashboard/citas", icon: Calendar, label: "Citas" },
  { href: "/dashboard/clientes", icon: Users, label: "Clientes" },
  { href: "/dashboard/horarios", icon: Clock, label: "Horarios" },
  { href: "/dashboard/estadisticas", icon: TrendingUp, label: "Estadísticas" },
  { href: "/dashboard/servicios", icon: Scissors, label: "Servicios" },
  { href: "/dashboard/productos", icon: Package, label: "Productos" },
  { href: "/dashboard/configuracion", icon: Settings, label: "Configuración" },
];

const adminNavItem = { href: "/dashboard/usuarios", icon: UserPlus, label: "Usuarios" };

export function DashboardSidebar({ barber }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdminRole() {
      const supabase = createClient();
      const { data } = await supabase
        .from("usuario")
        .select("rol")
        .eq("id", barber.id)
        .single();

      setIsAdmin(data?.rol === "admin" || data?.rol === "owner");
    }
    checkAdminRole();
  }, [barber.id]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const allNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-4 right-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-white dark:bg-zinc-900"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:static",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo and Brand */}
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage
                  src={barber.usuario?.profile_image || undefined}
                  alt={barber.nombre || "Barbero"}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                  {barber.nombre
                    ? barber.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : 'BB'
                  }
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  Bienvenido
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                  {barber.nombre || "Barbero"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {allNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-blue-600 dark:text-blue-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Tema</span>
              <ModeToggle />
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-5 w-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
