"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ResultadoAccion = { success: true } | { success: false; error: string };

/** Estado "en curso", toast y refresco compartidos por los botones de acción del panel /admin. */
export function useAccionAdmin() {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState<string | null>(null);

  const ejecutar = async (clave: string, accion: () => Promise<ResultadoAccion>, exito: string) => {
    setEnCurso(clave);
    try {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(exito);
      router.refresh();
    } finally {
      setEnCurso(null);
    }
  };

  const cargando = (clave: string) => enCurso === clave && <Loader2 className="h-4 w-4 animate-spin" />;

  return { enCurso, ejecutar, cargando };
}
