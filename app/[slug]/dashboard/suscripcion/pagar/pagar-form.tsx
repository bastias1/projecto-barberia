"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormularioTarjeta, type DatosTarjeta } from "@/components/pagos/formulario-tarjeta";
import { formatCLP } from "@/lib/datetime";

/** Suscripción mensual con tarjeta: el token se envía a /api/suscripcion/checkout. */
export function PagarSuscripcionForm({ slug, idPlan, monto }: { slug: string; idPlan: number; monto: number }) {
  const router = useRouter();

  const pagar = async ({ token }: DatosTarjeta): Promise<string | null> => {
    const res = await fetch(`/api/suscripcion/checkout?barberia=${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idPlan, token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "No se pudo procesar el pago. Intenta nuevamente.";

    toast.success("Suscripción activada. El cobro mensual quedó configurado.");
    router.push(`/${slug}/dashboard/suscripcion`);
    router.refresh();
    return null;
  };

  return (
    <FormularioTarjeta
      monto={monto}
      textoBoton={`Suscribirme por ${formatCLP(monto)}/mes`}
      nota="Pago procesado de forma segura por Mercado Pago. Se cobra cada mes a esta tarjeta."
      datosBoton={{ "data-mp-subscription-cta": "without-plan-authorized" }}
      onPagar={pagar}
    />
  );
}
