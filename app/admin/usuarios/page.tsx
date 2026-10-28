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
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { requireSuperadmin } from "@/lib/superadmin";
import { ROL_LABEL } from "@/lib/roles";
import { formatFecha } from "@/lib/datetime";
import { one } from "@/lib/utils";

const POR_PAGINA = 20;

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const yo = await requireSuperadmin();
  const { q = "", pagina: paginaParam } = await searchParams;
  const pagina = Math.max(1, Number(paginaParam) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("usuario")
    .select("id_usuario, nombre, apellido, email, rol, created_at, deleted_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  // Comodines y separadores de PostgREST fuera del texto buscado
  const texto = q.trim().replace(/[%_,()*\\]/g, " ").trim();
  if (texto) query = query.or(`email.ilike.%${texto}%,nombre.ilike.%${texto}%,apellido.ilike.%${texto}%`);
  const { data: usuarios, count } = await query;

  const ids = (usuarios ?? []).map((u) => u.id_usuario);
  const service = createServiceRoleClient();
  const [{ data: membresias }, cuentas] = await Promise.all([
    ids.length
      ? supabase
          .from("usuario_barberia")
          .select("id_usuario, rol, activo, barberia:barberia!usuario_barberia_id_barberia_fkey (id_barberia, nombre)")
          .in("id_usuario", ids)
          .eq("activo", true)
      : Promise.resolve({ data: [] }),
    // Correo confirmado: solo lo sabe Auth (Admin API)
    Promise.all(ids.map((id) => service.auth.admin.getUserById(id).then(({ data }) => [id, data.user] as const))),
  ]);
  const authPorId = new Map(cuentas);
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-muted-foreground">{count ?? 0} cuentas{texto ? ` que coinciden con "${texto}"` : ""}</p>
        </div>
        <Suspense><Buscador placeholder="Buscar por correo o nombre" /></Suspense>
      </div>

      <EliminarDatosForm />

      <Card className="py-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Barberías</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuarios ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No hay usuarios que coincidan.</TableCell></TableRow>
              ) : (
                (usuarios ?? []).map((u) => {
                  const auth = authPorId.get(u.id_usuario);
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
                          {auth && !auth.email_confirmed_at && <Badge variant="outline">Correo sin confirmar</Badge>}
                          {!suspendido && u.rol !== "superadmin" && auth?.email_confirmed_at && <span className="text-xs text-muted-foreground">Activa</span>}
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

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} params={{ q }} base="/admin/usuarios" />
    </div>
  );
}
