import type { Metadata } from "next";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { requireSuperadmin } from "@/lib/superadmin";
import { PLATAFORMA } from "@/lib/plataforma";

export const metadata: Metadata = { title: `Panel · ${PLATAFORMA.nombre}` };
export const dynamic = "force-dynamic";

/** Panel de la plataforma: solo administradores (usuario.rol = 'superadmin'). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperadmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2 font-black tracking-tight">
            <span className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white dark:text-zinc-900" />
            </span>
            <span>{PLATAFORMA.nombre}</span>
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground">Panel de plataforma</span>
          </Link>
          <AdminNav />
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-sm text-muted-foreground">{admin.nombre}</span>
            <ModeToggle />
            <CerrarSesion />
          </div>
        </div>
      </header>
      <main id="contenido" className="max-w-7xl mx-auto p-4 pb-24 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
