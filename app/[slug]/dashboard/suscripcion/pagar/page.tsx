import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/staff-context";
import { createClient } from "@/utils/supabase/server";
import { caracteristicasPlan, getPlanes, MONTO_MINIMO_SUSCRIPCION } from "@/lib/planes";
import { formatCLP } from "@/lib/datetime";
import { PagarSuscripcionForm } from "./pagar-form";

export const dynamic = "force-dynamic";

/** Pago del plan mensual con tarjeta, con el mismo formulario que la tienda. */
export default async function PagarSuscripcionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireStaff(slug, { admin: true });
  const { plan: planParam } = await searchParams;
  const volver = `/${slug}/dashboard/suscripcion`;
  const supabase = await createClient();

  const [planes, { data: sus }] = await Promise.all([
    getPlanes(supabase),
    supabase
      .from("suscripcion")
      .select("id_plan, estado, id_suscripcion_externa")
      .eq("id_barberia", ctx.barberia.id_barberia)
      .order("id_suscripcion", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const plan = planes.find((p) => p.id_plan === Number(planParam));
  if (!plan || plan.precio_mensual < MONTO_MINIMO_SUSCRIPCION) redirect(volver);

  const pagando = sus?.estado === "activa" && !!sus.id_suscripcion_externa;
  if (pagando && sus?.id_plan === plan.id_plan) redirect(volver);
  const planAnterior = pagando ? planes.find((p) => p.id_plan === sus?.id_plan) : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" data-mp-subscriptions-page="without-plan-authorized">
      <Link href={volver} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        <span>Volver a Suscripción</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Pagar plan {plan.nombre}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">El cobro es mensual y automático a esta tarjeta. Puedes cancelarlo cuando quieras.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tarjeta de crédito o débito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">Total mensual</span>
              <strong className="text-lg text-zinc-900 dark:text-zinc-100">{formatCLP(plan.precio_mensual)}/mes</strong>
            </div>
            <PagarSuscripcionForm slug={slug} idPlan={plan.id_plan} monto={plan.precio_mensual} />
          </CardContent>
        </Card>

        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Plan {plan.nombre}</CardTitle>
            <CardDescription>{formatCLP(plan.precio_mensual)} al mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {caracteristicasPlan(plan).map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
            {planAnterior && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Al pagar, se detiene el cobro del plan {planAnterior.nombre}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
