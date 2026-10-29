import { requireStaff } from "@/lib/staff-context";
import { EstadisticasVista, type SearchParamsBI } from "@/components/dashboard/bi/estadisticas-vista";

/** Estadísticas de toda la barbería (solo admin). */
export default async function EstadisticasNegocioPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<SearchParamsBI>;
}) {
  const slug = (await params).slug;
  const ctx = await requireStaff(slug, { admin: true });

  return (
    <EstadisticasVista
      slug={slug} ctx={ctx} modo="negocio" searchParams={await searchParams}
      basePath={`/${slug}/dashboard/administracion/estadisticas`}
    />
  );
}
