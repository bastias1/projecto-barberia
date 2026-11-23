import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function PrivatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Área Privada</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Bienvenido, {user.email}</p>
      </div>
    </div>
  );
}
