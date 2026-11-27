import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModeToggle } from "@/components/mode-toggle";
import { AdminSidebar, TituloSeccion } from "@/components/admin/admin-nav";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireSuperadmin } from "@/lib/superadmin";
import { PLATAFORMA } from "@/lib/plataforma";

export const metadata: Metadata = { title: `Panel · ${PLATAFORMA.nombre}` };
export const dynamic = "force-dynamic";

/** Panel de la plataforma: solo administradores (usuario.rol = 'superadmin'). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperadmin();
  // Cookie que escribe SidebarProvider al plegar la barra
  const abierta = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={abierta}>
      <AdminSidebar nombre={admin.nombre} />
      {/* min-w-0: sin esto la tabla ancha estira la página en vez de hacer scroll dentro de su tarjeta */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" aria-label="Mostrar u ocultar menú" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <TituloSeccion />
          <div className="ml-auto flex items-center gap-1">
            <ModeToggle />
            <CerrarSesion />
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
