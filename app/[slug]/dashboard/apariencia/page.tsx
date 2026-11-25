import { requireStaff } from "@/lib/staff-context";
import { leerApariencia } from "@/lib/apariencia";
import { AparienciaEditor } from "@/components/dashboard/apariencia-editor";

export default async function AparienciaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { barberia } = await requireStaff((await params).slug, { admin: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Apariencia</h1>
        <p className="mt-1 text-muted-foreground">
          Elige qué secciones muestra tu página y en qué orden. Los cambios se publican al guardar.
        </p>
      </div>
      <AparienciaEditor idBarberia={barberia.id_barberia} slug={barberia.slug} inicial={leerApariencia(barberia.apariencia)} />
    </div>
  );
}
