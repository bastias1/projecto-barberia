"use client"

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Scissors, Calendar, Users, BarChart3, Settings, LogOut, Menu, X, Clock, TrendingUp, Home, UserPlus, Package, LayoutDashboard, ShieldCheck, MessageSquare } from "lucide-react";
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

const principalItems = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/dashboard/resumen", icon: BarChart3, label: "Resumen" },
  { href: "/dashboard/estadisticas", icon: TrendingUp, label: "Estadísticas" },
];

const managementItems = [
  { href: "/dashboard/citas", icon: Calendar, label: "Citas" },
  { href: "/dashboard/clientes", icon: Users, label: "Clientes" },
  { href: "/dashboard/horarios", icon: Clock, label: "Horarios" },
  { href: "/dashboard/servicios", icon: Scissors, label: "Servicios" },
  { href: "/dashboard/resenas", icon: MessageSquare, label: "Reseñas" },
];

const adminItems = [
  { href: "/dashboard/usuarios", icon: UserPlus, label: "Usuarios" },
  { href: "/dashboard/productos", icon: Package, label: "Productos" },
  { href: "/dashboard/pedidos", icon: Package, label: "Pedidos" },
];

export function DashboardSidebar({ barber }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const { data } = await supabase
        .from("usuario")
        .select("rol")
        .eq("id", barber.id)
        .single();

      if (data) {
        setRole(data.rol);
        setIsAdmin(data.rol === "admin" || data.rol === "owner");
      }
    }
    checkRole();
  }, [barber.id]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const NavLink = ({ item }: { item: any }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-200 text-sm",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className={cn("h-4 w-4", isActive && "text-sidebar-primary")} />
        <span>{item.label}</span>
      </Link>
    );
  };

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
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out md:translate-x-0 md:static flex flex-col",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage
                src={barber.usuario?.profile_image || undefined}
                alt={barber.nombre || "Barbero"}
              />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-bold text-xs">
                {barber.nombre
                  ? barber.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : 'BB'
                }
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">
                {barber.nombre || "Barbero"}
              </h2>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
                {role === "owner" ? "Dueño" : role || "Barbero"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Principal Section */}
          <div className="space-y-1 mb-6">
            <div className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Principal
            </div>
            {principalItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* Accordion Sections */}
          <Accordion type="multiple" defaultValue={["gestion", "admin"]} className="space-y-2">

            {/* Gestión */}
            <AccordionItem value="gestion" className="border-none">
              <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-sidebar-accent/50 rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-wider [&>svg]:h-4 [&>svg]:w-4">
                <span className="flex items-center gap-2">
                  Gestión
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0 space-y-1">
                {managementItems.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Administración (Conditional) */}
            {isAdmin && (
              <AccordionItem value="admin" className="border-none">
                <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-sidebar-accent/50 rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-wider [&>svg]:h-4 [&>svg]:w-4">
                  <span className="flex items-center gap-2">
                    Administración
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0 space-y-1">
                  {adminItems.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-1 bg-sidebar/50">
          <Link
            href="/dashboard/configuracion"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-200 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
              pathname === "/dashboard/configuracion" && "bg-sidebar-accent text-foreground font-medium"
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>

          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>Tema</span>
            <ModeToggle />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-4 h-8"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar Sesión
          </Button>
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
