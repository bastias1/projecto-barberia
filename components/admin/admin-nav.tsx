"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CreditCard, House, LayoutDashboard, Store, Sun, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PLATAFORMA } from "@/lib/plataforma";

export const ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Resumen" },
  { href: "/admin/barberias", icon: Store, label: "Barberías" },
  { href: "/admin/planes", icon: CreditCard, label: "Planes" },
  { href: "/admin/usuarios", icon: Users, label: "Usuarios" },
  { href: "/admin/actividad", icon: Activity, label: "Actividad" },
];

export const itemActivo = (pathname: string, href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

/** Barra lateral del panel: plegable a íconos en escritorio, hoja deslizable en móvil. */
export function AdminSidebar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={PLATAFORMA.nombre}>
              <Link href="/admin" onClick={() => setOpenMobile(false)}>
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground">
                  <Sun className="size-4" />
                </span>
                <span className="grid leading-tight">
                  <span className="display text-base">{PLATAFORMA.nombre}</span>
                  <span className="text-xs text-muted-foreground">Panel de plataforma</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Secciones del panel">
              {ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={itemActivo(pathname, item.href)} tooltip={item.label}>
                    <Link
                      href={item.href}
                      aria-current={itemActivo(pathname, item.href) ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Volver al inicio">
              <Link href="/"><House /><span>Inicio</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{nombre}</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Nombre de la sección actual, para el encabezado. */
export function TituloSeccion() {
  const pathname = usePathname();
  return <span className="text-sm font-medium">{ITEMS.findLast((i) => itemActivo(pathname, i.href))?.label}</span>;
}
