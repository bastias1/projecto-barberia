"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Scissors, Calendar, Users, BarChart3, Settings, LogOut, Menu, X, Clock, TrendingUp, Home, UserPlus, Package, MessageSquare, ChevronDown, Store, ExternalLink, CreditCard, Palette } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { isAdminRol, ROL_LABEL, type RolApp } from "@/lib/roles";
import { useBarberiaHref, useModulos } from "@/components/barberia-provider";
import { tieneModulo, type ModuloCodigo } from "@/lib/modulos";

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
  rol: RolApp;
  barberiaNombre: string;
  citasHoy: number; // pendientes o confirmadas de hoy
  esProfesional: boolean; // tiene agenda propia (ficha de profesional)
}

// Rutas relativas a /<slug>/dashboard
const principalItems: NavItem[] = [
  { href: "", icon: Home, label: "Inicio" },
  { href: "/resumen", icon: BarChart3, label: "Resumen" },
  { href: "/estadisticas", icon: TrendingUp, label: "Mis estadísticas", modulo: "bi", profesional: true },
];

const managementItems: NavItem[] = [
  { href: "/citas", icon: Calendar, label: "Citas" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/horarios", icon: Clock, label: "Horarios" },
  { href: "/servicios", icon: Scissors, label: "Servicios" },
  { href: "/resenas", icon: MessageSquare, label: "Reseñas" },
];

const adminItems: NavItem[] = [
  { href: "/usuarios", icon: UserPlus, label: "Equipo" },
  { href: "/barberia", icon: Store, label: "Mi Barbería" },
  { href: "/apariencia", icon: Palette, label: "Apariencia" },
  { href: "/administracion/estadisticas", icon: TrendingUp, label: "Estadísticas", modulo: "bi" },
  { href: "/suscripcion", icon: CreditCard, label: "Suscripción" },
  { href: "/productos", icon: Package, label: "Productos", modulo: "ecommerce" },
  { href: "/pedidos", icon: Package, label: "Pedidos", modulo: "ecommerce" },
];

// modulo: solo se muestra si la suscripción incluye ese módulo; profesional: solo a quien tiene agenda propia
type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; modulo?: ModuloCodigo; profesional?: boolean };

// Barra inferior en móvil: accesos principales con Inicio al centro; el resto, en el menú
const bottomItems: NavItem[] = [
  { href: "/resumen", icon: BarChart3, label: "Resumen" },
  { href: "/citas", icon: Calendar, label: "Citas" },
  { href: "", icon: Home, label: "Inicio" },
  { href: "/clientes", icon: Users, label: "Clientes" },
];

export function DashboardSidebar({ barber, rol, barberiaNombre, citasHoy, esProfesional }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const href = useBarberiaHref();
  const dashboardHref = (path: string) => href(`/dashboard${path}`);
  const modulos = useModulos();
  const visible = (item: NavItem) => (!item.modulo || tieneModulo(modulos, item.modulo)) && (!item.profesional || esProfesional);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isAdmin = isAdminRol(rol);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(href());
    router.refresh();
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === dashboardHref(item.href);
    return (
      <Link
        href={dashboardHref(item.href)}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "relative flex items-center gap-3 px-4 py-2 rounded-md transition-all duration-200 text-sm",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-sidebar-primary rounded-full" />
        )}
        <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
        <span>{item.label}</span>
        {item.href === "/citas" && citasHoy > 0 && (
          <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
            {citasHoy}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 pb-16 md:pb-0 transform bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out md:translate-x-0 md:static flex flex-col",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with profile menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-full p-6 border-b border-sidebar-border hover:bg-sidebar-accent/50 transition-colors text-left focus:outline-none"
          >
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
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {ROL_LABEL[rol]} · {barberiaNombre}
                </p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", profileMenuOpen && "rotate-180")} />
            </div>
          </button>

          {/* Profile dropdown */}
          {profileMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-full bg-popover text-popover-foreground border rounded-md shadow-md p-1 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
              <Link
                href={dashboardHref("/configuracion")}
                onClick={() => { setProfileMenuOpen(false); setMobileMenuOpen(false); }}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  pathname === dashboardHref("/configuracion") && "font-medium"
                )}
              >
                <Settings className="h-4 w-4" />
                Configuración
              </Link>

              <Link
                href={href()}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ver página pública
              </Link>

              <div className="bg-border -mx-1 my-1 h-px" />

              <div className="flex items-center justify-between px-2 py-1.5 text-sm text-muted-foreground">
                <span>Tema</span>
                <ModeToggle />
              </div>

              <div className="bg-border -mx-1 my-1 h-px" />

              <button
                onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Principal Section */}
          <div className="space-y-1 mb-6">
            <div className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Principal
            </div>
            {principalItems.filter(visible).map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* Accordion Sections */}
          <Accordion type="multiple" defaultValue={["gestion", "admin"]} className="space-y-2">

            {/* Gestión */}
            <AccordionItem value="gestion" className="border-none">
              <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-sidebar-accent/50 rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-widest [&>svg]:h-4 [&>svg]:w-4">
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
                <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-sidebar-accent/50 rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-widest [&>svg]:h-4 [&>svg]:w-4">
                  <span className="flex items-center gap-2">
                    Administración
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0 space-y-1">
                  {adminItems.filter(visible).map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-sidebar-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          {bottomItems.map((item) => {
            const isActive = !mobileMenuOpen && pathname === dashboardHref(item.href);
            const isHome = item.href === "";
            return (
              <Link
                key={item.label}
                href={dashboardHref(item.href)}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                )}
              >
                {isHome ? (
                  <span
                    className={cn(
                      "-mt-7 h-14 w-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-background transition-transform active:scale-95",
                      "bg-primary text-primary-foreground",
                      isActive && "scale-105"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                  </span>
                ) : (
                  <span className="relative">
                    <item.icon className="h-5 w-5" />
                    {item.href === "/citas" && citasHoy > 0 && (
                      <span
                        className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white"
                        aria-label={`${citasHoy} citas por atender hoy`}
                      >
                        {citasHoy > 9 ? "9+" : citasHoy}
                      </span>
                    )}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              mobileMenuOpen ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span>Menú</span>
          </button>
        </div>
      </nav>

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
