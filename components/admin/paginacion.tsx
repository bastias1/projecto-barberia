import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Anterior / siguiente conservando los demás parámetros de la URL. */
export function Paginacion({
  pagina,
  totalPaginas,
  params,
  base,
}: {
  pagina: number;
  totalPaginas: number;
  params: Record<string, string | undefined>;
  base: string;
}) {
  if (totalPaginas <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, pagina: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${q.toString()}`;
  };
  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>Página {pagina} de {totalPaginas}</span>
      <div className="flex gap-2">
        {pagina > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(pagina - 1)}>Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}
        {pagina < totalPaginas ? <Button asChild variant="outline" size="sm"><Link href={href(pagina + 1)}>Siguiente</Link></Button> : <Button variant="outline" size="sm" disabled>Siguiente</Button>}
      </div>
    </div>
  );
}
