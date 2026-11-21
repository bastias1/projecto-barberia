"use client"

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

/**
 * Login/registro con Google (Supabase Auth, solo email y perfil). La vuelta es /auth/callback,
 * que pide aceptar los términos a quien entra por primera vez. `next`/`barberia` como en /login.
 */
export function ContinuarConGoogle({ next, barberia }: { next?: string | null; barberia?: string | null }) {
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    const params = new URLSearchParams({ ...(next ? { next } : {}), ...(barberia ? { barberia } : {}) });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?${params}` },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión con Google");
      setCargando(false);
    }
  };

  return (
    <Button type="button" variant="outline" className="w-full h-11 gap-2" onClick={entrar} disabled={cargando}>
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
      )}
      Continuar con Google
    </Button>
  );
}
