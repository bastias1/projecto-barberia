import { redirect } from "next/navigation";

/** Link corto para compartir: /<barberia>/<sucursal>/agendar -> agendar con la sucursal elegida. */
export default async function AgendarEnSucursal({ params }: { params: Promise<{ slug: string; sucursal: string }> }) {
  const { slug, sucursal } = await params;
  redirect(`/${slug}/agendar?sucursal=${encodeURIComponent(sucursal)}`);
}
