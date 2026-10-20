import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarberiaProvider } from "@/components/barberia-provider";
import { getBarberiaCached, getModulosCached } from "@/lib/barberia-server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const barberia = await getBarberiaCached((await params).slug);
  if (!barberia) return {};

  const descripcion = barberia.eslogan || `Agenda tu cita en ${barberia.nombre}.`;
  return {
    title: `${barberia.nombre} - Reservas Online`,
    description: descripcion,
    openGraph: { title: barberia.nombre, description: descripcion, type: "website", locale: "es_CL" },
  };
}

/** Todo lo que cuelga de /<slug> pertenece a una barbería activa. */
export default async function BarberiaLayout({ children, params }: Props) {
  const barberia = await getBarberiaCached((await params).slug);
  if (!barberia) notFound();
  const modulos = await getModulosCached(barberia.id_barberia);

  return <BarberiaProvider barberia={barberia} modulos={modulos}>{children}</BarberiaProvider>;
}
