import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff-context";
import { EstadisticasVista, type SearchParamsBI } from "@/components/dashboard/bi/estadisticas-vista";

/** "Mis estadísticas": lo del barbero que mira. La de toda la barbería es Administración → Estadísticas. */
export default async function MisEstadisticasPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<SearchParamsBI>;
}) {
  const slug = (await params).slug;
  // Sin { admin }: entra el barbero y también el admin que atiende
  const ctx = await requireStaff(slug);
  // Sin agenda propia no hay métricas propias: el admin va a las del negocio
  if (!ctx.isProfesional) redirect(ctx.isAdmin ? `/${slug}/dashboard/administracion/estadisticas` : `/${slug}/dashboard`);

  return (
    <EstadisticasVista
      slug={slug} ctx={ctx} modo="propio" searchParams={await searchParams}
      basePath={`/${slug}/dashboard/estadisticas`}
    />
  );
}
