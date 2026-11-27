import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoSeccion } from "@/components/cuenta/secciones";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireCuenta } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

/** Perfil: foto, nombre y teléfono que ven las barberías donde trabaja o reserva, y el correo. */
export default async function PerfilPage() {
  const { supabase, user } = await requireCuenta("/cuenta/perfil");
  const { data: usuario } = await supabase.from("usuario").select("nombre, apellido, profile_image").eq("id_usuario", user.id).maybeSingle();
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || (user.email ?? "");

  return (
    <>
      <EncabezadoSeccion titulo="Perfil" descripcion="Lo que ven las barberías donde reservas, compras o trabajas." />
      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>Aparece en tu menú y, si atiendes, en la página de la barbería.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload userId={user.id} currentImage={usuario?.profile_image} userName={nombre} />
        </CardContent>
      </Card>
      <ProfileForm />
    </>
  );
}
