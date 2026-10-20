"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBarberia } from "@/components/barberia-provider";
import { formatCLP } from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface PlanOpcion {
  id_plan: number;
  nombre: string;
  precio: number;
  caracteristicas: string[];
}

/** Elegir plan y pagar con Mercado Pago, o detener la renovación automática. */
export function SuscripcionAcciones({
  planes,
  planActual,
  pagando,
}: {
  planes: PlanOpcion[];
  planActual: number | null;
  pagando: boolean; // tiene cobro automático activo
}) {
  const router = useRouter();
  const { slug } = useBarberia();
  const [idPlan, setIdPlan] = useState(String(planActual ?? planes[0]?.id_plan ?? ""));
  const [enviando, setEnviando] = useState(false);

  const elegido = planes.find((p) => String(p.id_plan) === idPlan);
  const mismoPlanPagado = pagando && elegido?.id_plan === planActual;

  const pagar = async () => {
    setEnviando(true);
    try {
      const response = await fetch(`/api/suscripcion/checkout?barberia=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPlan: Number(idPlan) }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        toast.error(data.error || "No se pudo iniciar el pago");
        return;
      }
      window.location.href = data.url;
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async () => {
    setEnviando(true);
    try {
      const response = await fetch(`/api/suscripcion/cancelar?barberia=${slug}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "No se pudo cancelar");
        return;
      }
      toast.success("Cobro automático cancelado. Tu plan sigue activo hasta la fecha de término.");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4 border-t pt-6">
      <p className="text-sm font-medium">{pagando ? "Cambiar de plan" : "Elige tu plan"}</p>
      <RadioGroup value={idPlan} onValueChange={setIdPlan} className="grid gap-3 md:grid-cols-3">
        {planes.map((p) => (
          <div key={p.id_plan}>
            <RadioGroupItem value={String(p.id_plan)} id={`plan-${p.id_plan}`} className="peer sr-only" />
            <Label
              htmlFor={`plan-${p.id_plan}`}
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border-2 p-4 cursor-pointer transition-colors font-normal",
                idPlan === String(p.id_plan) ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900" : "border-zinc-200 dark:border-zinc-800"
              )}
            >
              <span className="flex items-center justify-between">
                <span className="font-bold">{p.nombre}</span>
                {p.id_plan === planActual && <span className="text-xs text-muted-foreground">Actual</span>}
              </span>
              <span className="text-sm text-muted-foreground">{formatCLP(p.precio)}/mes</span>
              <ul className="space-y-1 mt-1">
                {p.caracteristicas.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          El cobro es mensual y automático con Mercado Pago. Puedes cancelarlo cuando quieras.
        </p>
        <div className="flex gap-2">
          {pagando && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-red-600" disabled={enviando}>Cancelar suscripción</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar el cobro automático?</AlertDialogTitle>
                  <AlertDialogDescription>
                    No se te volverá a cobrar. Tu plan sigue activo hasta la fecha de término; después se apagan
                    las reservas en línea y los demás módulos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelar}>Cancelar suscripción</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={pagar} disabled={enviando || !elegido || mismoPlanPagado} className="gap-2">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {mismoPlanPagado ? "Plan actual" : pagando ? `Cambiar a ${elegido?.nombre}` : `Pagar ${elegido ? formatCLP(elegido.precio) : ""} con Mercado Pago`}
          </Button>
        </div>
      </div>
    </div>
  );
}
