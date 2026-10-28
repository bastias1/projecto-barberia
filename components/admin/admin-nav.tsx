"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CreditCard, LayoutDashboard, Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Resumen" },
  { href: "/admin/barberias", icon: Store, label: "Barberías" },
  { href: "/admin/planes", icon: CreditCard, label: "Planes" },
  { href: "/admin/usuarios", icon: Users, label: "Usuarios" },
  { href: "/admin/actividad", icon: Activity, label: "Actividad" },
];

const activo = (pathname: string, href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

/** Pestañas en escritorio y barra inferior en móvil (mismo patrón que el dashboard). */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden md:flex items-center gap-1" aria-label="Secciones del panel">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              activo(pathname, item.href) ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="Secciones del panel"
        className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
                activo(pathname, item.href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
