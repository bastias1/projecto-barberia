import { TeamManagement, type Invitacion, type Miembro } from "@/components/dashboard/team-management";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { createClient } from "@/utils/supabase/server";
import { one } from "@/lib/utils";

export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug, { admin: true });
  const idBarberia = ctx.barberia.id_barberia;
  const supabase = await createClient();

  const [{ data: membresias }, { data: profesionales }, { data: invitaciones }, { data: maxBarberos }, modulos] = await Promise.all([
    supabase
      .from("usuario_barberia")
      .select("rol, usuario:usuario!usuario_barberia_id_usuario_fkey (id_usuario, nombre, apellido, email, profile_image, deleted_at)")
      .eq("id_barberia", idBarberia)
      .in("rol", ["admin", "profesional"])
      .eq("activo", true),
    supabase
      .from("profesional")
      .select("id_profesional, especialidad, activo")
      .eq("id_barberia", idBarberia),
    supabase
      .from("invitacion")
      .select("id_invitacion, correo, rol, token, expira_at, created_at")
      .eq("id_barberia", idBarberia)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false }),
    supabase.rpc("barberia_limite", { p_barberia: idBarberia, p_codigo: "max_profesionales" }),
    getModulosCached(idBarberia),
  ]);

  const fichas = new Map((profesionales ?? []).map((p) => [p.id_profesional, p]));
  type Usuario = { id_usuario: string; nombre: string; apellido: string | null; email: string; profile_image: string | null; deleted_at: string | null };
  const miembros: Miembro[] = (membresias ?? [])
    .map((m) => ({ rol: m.rol as Miembro["rol"], u: one<Usuario>(m.usuario) }))
    .filter((m): m is { rol: Miembro["rol"]; u: Usuario } => !!m.u && !m.u.deleted_at)
    .map(({ rol, u }) => ({
      id: u.id_usuario,
      nombre: [u.nombre, u.apellido].filter(Boolean).join(" "),
      correo: u.email,
      profile_image: u.profile_image,
      rol,
      especialidad: fichas.get(u.id_usuario)?.especialidad ?? null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const barberosActivos = (profesionales ?? []).filter((p) => p.activo).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Equipo</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Invita a barberos y administradores por correo. Cada uno usa su propia cuenta.
        </p>
      </div>

      <TeamManagement
        currentUserId={ctx.userId}
        miembros={miembros}
        invitaciones={(invitaciones ?? []) as Invitacion[]}
        suscripcionVigente={modulos.includes("agenda")}
        cupoBarberos={{ usados: barberosActivos, maximo: (maxBarberos as number | null) ?? null }}
      />
    </div>
  );
}
