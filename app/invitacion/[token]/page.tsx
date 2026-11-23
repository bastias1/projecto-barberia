import Link from "next/link";
import { MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponderInvitacion } from "@/components/cuenta/responder-invitacion";
import { CerrarSesion } from "@/components/cuenta/cerrar-sesion";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaById } from "@/lib/barberia";
import { ROL_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "camila.reyes@gmail.com" -> "ca***@gmail.com" */
function ocultarCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

function Shell({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="max-w-md w-full border shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center mb-2">
            <MailOpen className="h-7 w-7 text-white dark:text-zinc-900" />
          </div>
          <CardTitle className="text-2xl">{titulo}</CardTitle>
          {descripcion && <CardDescription className="text-base">{descripcion}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="space-y-4">{children}</CardContent>}
      </Card>
    </div>
  );
}

/**
 * Link del correo de invitación. El token (UUID aleatorio) identifica la
 * invitación; para responderla hay que iniciar sesión con el correo invitado.
 */
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) {
    return <Shell titulo="Invitación no válida" descripcion="Revisa que hayas copiado el link completo desde el correo." />;
  }

  // Solo se lee la invitación de este token, para mostrar a qué barbería es
  const admin = createServiceRoleClient();
  const { data: inv } = await admin
    .from("invitacion")
    .select("id_barberia, correo, rol, estado, expira_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv) {
    return <Shell titulo="Invitación no válida" descripcion="Revisa que hayas copiado el link completo desde el correo." />;
  }

  const barberia = await getBarberiaById(admin, inv.id_barberia);
  const nombre = barberia?.nombre ?? "la barbería";
  const rol = ROL_LABEL[inv.rol as "admin" | "profesional"].toLowerCase();

  if (inv.estado !== "pendiente") {
    const textos: Record<string, string> = {
      aceptada: `Ya aceptaste esta invitación. Entra a tu cuenta para ir al dashboard de ${nombre}.`,
      rechazada: "Rechazaste esta invitación. Si cambiaste de opinión, pide una nueva.",
      cancelada: "La barbería canceló esta invitación.",
    };
    return (
      <Shell titulo={`Invitación a ${nombre}`} descripcion={textos[inv.estado]}>
        <Link href="/cuenta" className="block"><Button className="w-full">Ir a mi cuenta</Button></Link>
      </Shell>
    );
  }
  if (new Date(inv.expira_at) < new Date()) {
    return <Shell titulo="Invitación vencida" descripcion={`Pídele a ${nombre} que te envíe una nueva.`} />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const volver = encodeURIComponent(`/invitacion/${token}`);

  if (!user) {
    return (
      <Shell titulo={`${nombre} te invita a su equipo`} descripcion={`Te invitan como ${rol}. Para responder, entra con ${ocultarCorreo(inv.correo)}.`}>
        <Link href={`/login?next=${volver}`} className="block"><Button className="w-full h-11">Iniciar sesión</Button></Link>
        <Link href={`/signup?next=${volver}&email=${encodeURIComponent(inv.correo)}`} className="block">
          <Button variant="outline" className="w-full h-11">Crear mi cuenta gratis</Button>
        </Link>
      </Shell>
    );
  }

  if (user.email?.toLowerCase() !== inv.correo) {
    return (
      <Shell
        titulo="Esta invitación es para otra cuenta"
        descripcion={`Fue enviada a ${ocultarCorreo(inv.correo)} y tienes la sesión iniciada como ${user.email}.`}
      >
        <div className="text-center"><CerrarSesion redirigirA={`/login?next=${volver}`} /></div>
      </Shell>
    );
  }

  return (
    <Shell titulo={`${nombre} te invita a su equipo`} descripcion={`Te invitan como ${rol}. Al aceptar podrás usar su agenda y el dashboard.`}>
      <div className="flex justify-center">
        <ResponderInvitacion token={token} barberia={nombre} />
      </div>
    </Shell>
  );
}
