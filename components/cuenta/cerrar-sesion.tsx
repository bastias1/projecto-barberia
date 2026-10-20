"use client"

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export function CerrarSesion({ redirigirA = "/" }: { redirigirA?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="gap-2 text-red-600 hover:text-red-700"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push(redirigirA);
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </Button>
  );
}
