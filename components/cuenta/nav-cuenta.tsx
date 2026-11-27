"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SECCIONES } from "@/components/cuenta/secciones";
import { cn } from "@/lib/utils";

/** Secciones de la cuenta: barra lateral desde md, pestañas con scroll horizontal en teléfono. */
export function NavCuenta({ superadmin }: { superadmin: boolean }) {
  const ruta = usePathname();
  const items = superadmin ? [...SECCIONES, { href: "/admin", label: "Panel de la plataforma", texto: "", icon: ShieldCheck }] : SECCIONES;
  return (
    <nav aria-label="Mi cuenta" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {items.map(({ href, label, icon: Icon }) => {
          const activa = ruta === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                // En teléfono la pestaña activa puede quedar fuera de la franja
                ref={activa ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
                  activa ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
