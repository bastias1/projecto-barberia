import { requireStaff } from "@/lib/staff-context";
import { createClient } from "@/utils/supabase/server";
import { one } from "@/lib/utils";
import { BarberiaForm } from "@/components/dashboard/barberia-form";
import { SucursalesManager, type BarberoAdmin } from "@/components/dashboard/sucursales-manager";
import { MercadoPagoConexion } from "@/components/dashboard/mercadopago-conexion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mercadoPagoOAuthConfigurado } from "@/lib/mercadopago-oauth";

export default async function MiBarberiaPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mercadopago?: string }>;
}) {
  const ctx = await requireStaff((await params).slug, { admin: true });
  const idBarberia = ctx.barberia.id_barberia;
  const supabase = await createClient();
  const { data: conexionMP } = await supabase
    .from("barberia_mercadopago")
    .select("cuenta, estado, ultimo_error")
    .eq("id_barberia", idBarberia)
    .maybeSingle();

  // Sucursales (también las inactivas), barberos activos y sus asignaciones
  const [{ data: sucursales }, { data: profesionales }, { data: asignaciones }] = await Promise.all([
    supabase
      .from("sucursal")
      .select("id_sucursal, slug, nombre, direccion, comuna, region, telefono, activa")
      .eq("id_barberia", idBarberia)
      .order("id_sucursal", { ascending: true }),
    supabase
      .from("profesional")
      .select("id_profesional, alias, usuario:usuario!profesional_usuario_fkey (nombre, apellido, profile_image)")
      .eq("id_barberia", idBarberia)
      .eq("activo", true),
    supabase
      .from("profesional_sucursal")
      .select("id_profesional, id_sucursal")
      .eq("id_barberia", idBarberia),
  ]);

  const barberos: BarberoAdmin[] = (profesionales ?? [])
    .map((p) => {
      const u = one<{ nombre: string; apellido: string | null; profile_image: string | null }>(p.usuario);
      return {
        id: p.id_profesional,
        nombre: p.alias || [u?.nombre, u?.apellido].filter(Boolean).join(" ") || "Barbero",
        profile_image: u?.profile_image ?? null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Mi Barbería
        </h1>
        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
          Lo que ven tus clientes en{" "}
          <a href={`/${ctx.barberia.slug}`} target="_blank" className="font-mono underline-offset-4 hover:underline">
            /{ctx.barberia.slug}
          </a>
        </p>
      </div>

      <SucursalesManager
        sucursales={sucursales ?? []}
        barberos={barberos}
        asignaciones={asignaciones ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>La cuenta que recibe los pagos de tu tienda</CardDescription>
        </CardHeader>
        <CardContent>
          <MercadoPagoConexion slug={ctx.barberia.slug} conexion={conexionMP} configurado={mercadoPagoOAuthConfigurado()}
            resultado={(await searchParams).mercadopago} />
        </CardContent>
      </Card>

      <BarberiaForm barberia={ctx.barberia} />
    </div>
  );
}
