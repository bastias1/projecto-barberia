"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AparienciaDiseno } from "@/components/dashboard/apariencia-diseno";
import { AparienciaSecciones } from "@/components/dashboard/apariencia-secciones";
import { AparienciaTema } from "@/components/dashboard/apariencia-tema";
import { VistaPrevia } from "@/components/dashboard/apariencia-vista-previa";
import { createClient } from "@/utils/supabase/client";
import { aparienciaPorDefecto, type Apariencia } from "@/lib/apariencia";

export function AparienciaEditor({ idBarberia, slug, inicial }: { idBarberia: string; slug: string; inicial: Apariencia }) {
  const router = useRouter();
  const [apariencia, setApariencia] = useState(inicial);
  const [guardada, setGuardada] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const sinCambios = JSON.stringify(apariencia) === JSON.stringify(guardada);

  const guardar = async () => {
    setGuardando(true);
    // RLS: solo el admin de la barbería puede actualizarla
    const { data, error } = await createClient()
      .from("barberia")
      .update({ apariencia })
      .eq("id_barberia", idBarberia)
      .select("id_barberia");
    setGuardando(false);

    if (error || !data?.length) {
      console.error("Error updating apariencia:", error);
      toast.error("No se pudieron guardar los cambios");
      return;
    }
    setGuardada(apariencia);
    toast.success("Cambios guardados");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        <CardContent>
          <Tabs defaultValue="secciones" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="secciones">Secciones</TabsTrigger>
              <TabsTrigger value="tema">Tema</TabsTrigger>
              <TabsTrigger value="diseno">Diseño</TabsTrigger>
            </TabsList>
            <TabsContent value="diseno">
              <AparienciaDiseno idBarberia={idBarberia} apariencia={apariencia} onChange={setApariencia} />
            </TabsContent>
            <TabsContent value="tema">
              <AparienciaTema tema={apariencia.tema} onChange={(tema) => setApariencia({ ...apariencia, tema })} />
            </TabsContent>
            <TabsContent value="secciones">
              <AparienciaSecciones secciones={apariencia.secciones} onChange={(secciones) => setApariencia({ ...apariencia, secciones })} />
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setApariencia(aparienciaPorDefecto())}>
              <RotateCcw className="size-4" aria-hidden="true" />Restablecer todo
            </Button>
            <Button type="button" onClick={guardar} disabled={guardando || sinCambios}>
              {guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <VistaPrevia slug={slug} apariencia={apariencia} />
    </div>
  );
}
