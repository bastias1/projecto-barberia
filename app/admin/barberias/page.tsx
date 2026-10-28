import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Buscador } from "@/components/admin/buscador";
import { Paginacion } from "@/components/admin/paginacion";
import { createClient } from "@/utils/supabase/server";
import { getBarberiasAdmin, type EstadoClave } from "@/lib/admin-datos";
import { formatFecha } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const POR_PAGINA = 20;

const FILTROS: { clave: string; label: string; incluye: EstadoClave[] }[] = [
  { clave: "todas", label: "Todas", incluye: [] },
  { clave: "pagando", label: "Pagando", incluye: ["activa_mp", "activa"] },
  { clave: "prueba", label: "En prueba", incluye: ["prueba"] },
  { clave: "cortesia", label: "Cortesía", incluye: ["cortesia"] },
  { clave: "vencidas", label: "Vencidas", incluye: ["vencida", "sin"] },
  { clave: "suspendidas", label: "Suspendidas", incluye: ["suspendida"] },
];

export default async function AdminBarberias({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; pagina?: string }>;
}) {
  const { q = "", estado = "todas", pagina: paginaParam } = await searchParams;
  const todas = await getBarberiasAdmin(await createClient());

  const filtro = FILTROS.find((f) => f.clave === estado) ?? FILTROS[0];
  const texto = q.trim().toLowerCase();
  const filtradas = todas.filter((b) =>
    (filtro.incluye.length === 0 || filtro.incluye.includes(b.estado.clave)) &&
    (!texto || b.nombre.toLowerCase().includes(texto) || b.slug.includes(texto) || b.duenos.some((d) => d.email.includes(texto)))
  );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = Math.min(totalPaginas, Math.max(1, Number(paginaParam) || 1));
  const visibles = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Barberías</h1>
        <p className="text-muted-foreground">{todas.length} registradas en la plataforma</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => {
            const cantidad = f.incluye.length ? todas.filter((b) => f.incluye.includes(b.estado.clave)).length : todas.length;
            return (
              <Link
                key={f.clave}
                href={`/admin/barberias?${new URLSearchParams({ ...(q ? { q } : {}), estado: f.clave })}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  f.clave === filtro.clave ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                )}
              >
                {f.label} ({cantidad})
              </Link>
            );
          })}
        </div>
        <Suspense><Buscador placeholder="Buscar por nombre, slug o correo del dueño" /></Suspense>
      </div>

      <Card className="py-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbería</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead className="text-right">Barberos</TableHead>
                <TableHead className="text-right">Reservas del mes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No hay barberías con ese filtro.</TableCell></TableRow>
              ) : (
                visibles.map((b) => (
                  <TableRow key={b.id_barberia}>
                    <TableCell>
                      <Link href={`/admin/barberias/${b.id_barberia}`} className="font-medium hover:underline">{b.nombre}</Link>
                      <p className="text-xs text-muted-foreground font-mono">/{b.slug}</p>
                    </TableCell>
                    <TableCell>{b.plan ?? "—"}</TableCell>
                    <TableCell><Badge variant={b.estado.tono}>{b.estado.label}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.suscripcion?.fecha_termino ? formatFecha(b.suscripcion.fecha_termino, "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{b.duenos[0]?.email ?? <span className="text-muted-foreground">Sin admin</span>}</TableCell>
                    <TableCell className="text-right">{b.barberos}</TableCell>
                    <TableCell className="text-right">{b.reservasMes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} params={{ q, estado }} base="/admin/barberias" />
    </div>
  );
}
