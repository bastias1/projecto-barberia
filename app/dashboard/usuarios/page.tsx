import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagement } from "@/components/dashboard/user-management";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has admin/owner role
  const { data: userData } = await supabase
    .from("usuario")
    .select("rol")
    .eq("id", user.id)
    .single();

  const isAdmin = userData?.rol === "admin" || userData?.rol === "owner";

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Gestión de Usuarios
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Crea y administra cuentas de barberos
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
