import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Buscador } from "@/components/admin/buscador";
import { Paginacion } from "@/components/admin/paginacion";
import { EncabezadoOrden, FiltroFacetado, FiltroFechas, LimpiarFiltros } from "@/components/admin/filtros";
import { createClient } from "@/utils/supabase/server";
import { getBarberiasAdmin } from "@/lib/admin-datos";
import { filtrarBarberias, GRUPOS_ESTADO, type ParamsBarberias } from "@/lib/admin-filtros";
import { formatFecha } from "@/lib/datetime";

const POR_PAGINA = 20;
const FILTROS = ["q", "estado", "plan", "region", "desde", "hasta"];

export default async function AdminBarberias({
  searchParams,
}: {
  searchParams: Promise<ParamsBarberias & { pagina?: string }>;
}) {
  const { pagina: paginaParam, ...params } = await searchParams;
  // shortcut: carga todas y filtra en memoria; pasar los filtros a SQL pasadas las ~1000 barberías (PostgREST corta ahí)
  const todas = await getBarberiasAdmin(await createClient());

  const filtradas = filtrarBarberias(todas, params);
  // Cuántas de cada estado/plan/región quedan con el resto de filtros puestos
  const sinEstado = filtrarBarberias(todas, params, { sinEstado: true });
  const contar = (f: (b: (typeof todas)[number]) => boolean, base = todas) => base.filter(f).length;
  const planes = [...new Set(todas.map((b) => b.plan).filter((p): p is string => !!p))].sort();
  const regiones = [...new Set(todas.flatMap((b) => b.regiones))].sort();

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = Math.min(totalPaginas, Math.max(1, Number(paginaParam) || 1));
  const visibles = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Barberías</h1>
        <p className="text-muted-foreground">
          {filtradas.length === todas.length ? `${todas.length} registradas en la plataforma` : `${filtradas.length} de ${todas.length} barberías`}
        </p>
      </div>

      <Suspense>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Buscador placeholder="Buscar por nombre, slug o correo del dueño" />
          <div className="flex flex-wrap items-center gap-2">
            <FiltroFacetado
              param="estado"
              titulo="Estado"
              opciones={GRUPOS_ESTADO.map((g) => ({ valor: g.clave, label: g.label, cantidad: contar((b) => g.incluye.includes(b.estado.clave), sinEstado) }))}
            />
            <FiltroFacetado param="plan" titulo="Plan" opciones={planes.map((p) => ({ valor: p, label: p, cantidad: contar((b) => b.plan === p) }))} />
            {regiones.length > 0 && (
              <FiltroFacetado param="region" titulo="Región" opciones={regiones.map((r) => ({ valor: r, label: r, cantidad: contar((b) => b.regiones.includes(r)) }))} />
            )}
            <FiltroFechas titulo="Vence" />
            <LimpiarFiltros params={FILTROS} />
          </div>
        </div>
      </Suspense>

      <Card className="py-0">
        <CardContent className="p-0 overflow-x-auto">
          <Suspense>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><EncabezadoOrden campo="nombre">Barbería</EncabezadoOrden></TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead><EncabezadoOrden campo="vence">Vence</EncabezadoOrden></TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead className="text-right"><EncabezadoOrden campo="barberos" className="ml-auto -mr-3">Barberos</EncabezadoOrden></TableHead>
                  <TableHead className="text-right"><EncabezadoOrden campo="reservas" className="ml-auto -mr-3">Reservas del mes</EncabezadoOrden></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No hay barberías con esos filtros.</TableCell></TableRow>
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
                      <TableCell className="text-right tabular-nums">{b.barberos}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.reservasMes}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Suspense>
        </CardContent>
      </Card>

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} params={{ ...params }} base="/admin/barberias" />
    </div>
  );
}
