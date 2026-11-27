import { HeaderPlataforma } from "@/components/plataforma/header";
import { NavCuenta } from "@/components/cuenta/nav-cuenta";
import { getSesionCuenta } from "@/lib/cuenta";

/**
 * Marco de la cuenta. No redirige: /cuenta/clave se abre sin sesión desde el link de recuperación
 * (ahí va sin menú); cada sección exige la sesión por su cuenta (requireCuenta).
 */
export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getSesionCuenta();
  if (!user) return children;
  const { data: usuario } = await supabase.from("usuario").select("rol").eq("id_usuario", user.id).maybeSingle();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <HeaderPlataforma simple />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[13rem_1fr] md:gap-10 md:py-10">
        <aside className="min-w-0 md:sticky md:top-24 md:self-start">
          <NavCuenta superadmin={usuario?.rol === "superadmin"} />
        </aside>
        <main id="contenido" className="min-w-0 max-w-3xl space-y-6">{children}</main>
      </div>
    </div>
  );
}
