import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Buscador } from "@/components/admin/buscador";
import { Paginacion } from "@/components/admin/paginacion";
import { UsuarioAcciones } from "@/components/admin/usuario-acciones";
import { EliminarDatosForm } from "@/components/admin/eliminar-datos-form";
import { createClient } from "@/utils/supabase/server";
import { FiltroFacetado, FiltroFechas, LimpiarFiltros } from "@/components/admin/filtros";
import { lista } from "@/lib/admin-filtros";
import { requireSuperadmin } from "@/lib/superadmin";
import { ROL_LABEL } from "@/lib/roles";
import { formatFecha } from "@/lib/datetime";
import { one } from "@/lib/utils";

const POR_PAGINA = 20;
const TIPOS = [
  { valor: "superadmin", label: "Admin plataforma" },
  { valor: "suspendida", label: "Suspendida" },
  { valor: "sin_confirmar", label: "Correo sin confirmar" },
  { valor: "eliminada", label: "Datos eliminados" },
];
const MEMBRESIAS = [
  { valor: "staff", label: "Personal de una barbería" },
  { valor: "cliente", label: "Solo cliente" },
  { valor: "ninguna", label: "Sin barbería" },
];
const fecha = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const elegidos = (valor: string | undefined, opciones: { valor: string }[]) => lista(valor).filter((v) => opciones.some((o) => o.valor === v));

interface FilaUsuario {
  id_usuario: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  rol: string;
  created_at: string;
  deleted_at: string | null;
  email_confirmado: boolean;
  total: number;
}

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; membresia?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const yo = await requireSuperadmin();
  const { q = "", tipo, membresia, desde, hasta, pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number(paginaParam) || 1);
  const supabase = await createClient();

  const texto = q.trim();
  // Filtros, página y correo confirmado (auth.users) en la BD: admin_buscar_usuarios (DB.sql)
  const { data, error } = await supabase.rpc("admin_buscar_usuarios", {
    p_q: texto || null,
    p_tipo: elegidos(tipo, TIPOS),
    p_membresia: elegidos(membresia, MEMBRESIAS),
    p_desde: fecha(desde),
    p_hasta: fecha(hasta),
    p_limite: POR_PAGINA,
    p_offset: (pagina - 1) * POR_PAGINA,
  });
  if (error) console.error("admin_buscar_usuarios:", error);
  const usuarios = (data ?? []) as FilaUsuario[];
  const count = usuarios.length ? Number(usuarios[0].total) : 0;

  const ids = usuarios.map((u) => u.id_usuario);
  const { data: membresias } = ids.length
    ? await supabase
        .from("usuario_barberia")
        .select("id_usuario, rol, activo, barberia:barberia!usuario_barberia_id_barberia_fkey (id_barberia, nombre)")
        .in("id_usuario", ids)
        .eq("activo", true)
    : { data: [] };
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-3xl">Usuarios</h1>
          <p className="text-muted-foreground">{count} cuentas{texto || tipo || membresia || desde || hasta ? " con esos filtros" : ""}</p>
        </div>
      </div>

      <Suspense>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Buscador placeholder="Buscar por correo o nombre" />
          <LimpiarFiltros params={["q", "tipo", "membresia", "desde", "hasta"]} />
        </div>
      </Suspense>

      <EliminarDatosForm />

      <Card className="py-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead><Suspense><FiltroFacetado columna param="membresia" titulo="Barberías" opciones={MEMBRESIAS} /></Suspense></TableHead>
                <TableHead><Suspense><FiltroFechas columna titulo="Registro" /></Suspense></TableHead>
                <TableHead><Suspense><FiltroFacetado columna param="tipo" titulo="Estado" opciones={TIPOS} /></Suspense></TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No hay usuarios que coincidan.</TableCell></TableRow>
              ) : (
                usuarios.map((u) => {
                  const suspendido = !!u.deleted_at;
                  // Correo que deja eliminarDatosPersona (app/admin/actions.ts)
                  const eliminado = u.email.endsWith("@anon.invalid");
                  const suyas = (membresias ?? []).filter((m) => m.id_usuario === u.id_usuario);
                  return (
                    <TableRow key={u.id_usuario}>
                      <TableCell>
                        <p className="font-medium">{[u.nombre, u.apellido].filter(Boolean).join(" ")}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {suyas.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {suyas.map((m) => {
                            const b = one<{ id_barberia: string; nombre: string }>(m.barberia);
                            return (
                              <Link key={b?.id_barberia} href={`/admin/barberias/${b?.id_barberia}`}>
                                <Badge variant={m.rol === "cliente" ? "outline" : "secondary"} className="hover:underline">
                                  {b?.nombre} · {ROL_LABEL[m.rol as "admin" | "profesional" | "cliente"]}
                                </Badge>
                              </Link>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatFecha(u.created_at.slice(0, 10), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.rol === "superadmin" && <Badge>Admin plataforma</Badge>}
                          {eliminado ? <Badge variant="outline">Datos eliminados</Badge> : suspendido && <Badge variant="destructive">Suspendida</Badge>}
                          {!u.email_confirmado && <Badge variant="outline">Correo sin confirmar</Badge>}
                          {!suspendido && u.rol !== "superadmin" && u.email_confirmado && <span className="text-xs text-muted-foreground">Activa</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {eliminado ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <UsuarioAcciones
                            idUsuario={u.id_usuario}
                            email={u.email}
                            superadmin={u.rol === "superadmin"}
                            suspendido={suspendido}
                            esYo={u.id_usuario === yo.userId}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} params={{ q, tipo, membresia, desde, hasta }} base="/admin/usuarios" />
    </div>
  );
}
