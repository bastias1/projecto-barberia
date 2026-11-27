"use client";

import { useEffect, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { registrarBarberia } from "@/app/registro/actions";
import { caracteristicasPlan, type Plan } from "@/lib/planes";
import { formatCLP } from "@/lib/datetime";
import { cn, slugify } from "@/lib/utils";

export function RegistroForm({ planes, planInicial, pruebaDisponible }: { planes: Plan[]; planInicial?: number; pruebaDisponible: boolean }) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [idPlan, setIdPlan] = useState(String(planes.some((p) => p.id_plan === planInicial) ? planInicial : planes[0]?.id_plan ?? ""));
  const [sucursal, setSucursal] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [enviando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");

  // El dominio se conoce recién en el navegador (evita diferencias al hidratar)
  useEffect(() => setHost(window.location.host), []);

  const handleNombre = (value: string) => {
    setNombre(value);
    // La dirección web sigue al nombre hasta que el usuario la edite
    if (!slugEditado) setSlug(slugify(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // enviando sigue activo hasta que carga el dashboard (evita enviar dos veces)
    startTransition(async () => {
      try {
        const result = await registrarBarberia({
          nombre,
          slug,
          idPlan: Number(idPlan),
          sucursal,
          direccion,
          comuna,
          aceptaTerminos,
        });
        setError(result.error);
      } catch (err) {
        unstable_rethrow(err); // el redirect de la action llega como excepción
        console.error("Error registering barbería:", err);
        setError("Error inesperado al registrar la barbería");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la barbería</Label>
        <Input
          id="nombre"
          placeholder="Barbería El Puerto"
          value={nombre}
          onChange={(e) => handleNombre(e.target.value)}
          required
          maxLength={80}
          disabled={enviando}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Dirección web</Label>
        <div className="flex items-center rounded-md border border-input bg-background h-11 overflow-hidden focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 pr-1 text-sm text-muted-foreground select-none whitespace-nowrap">
            {host}/
          </span>
          <input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugEditado(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Letras minúsculas, números y guiones (sin guion al inicio ni al final)"
            placeholder="barberia-el-puerto"
            disabled={enviando}
            className="flex-1 min-w-0 h-full bg-transparent pr-3 text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">Es el link que compartirás con tus clientes.</p>
      </div>

      <div className="space-y-3">
        <Label>Plan</Label>
        <RadioGroup value={idPlan} onValueChange={setIdPlan} className="grid gap-3 sm:grid-cols-3">
          {planes.map((plan) => (
            <div key={plan.id_plan}>
              <RadioGroupItem value={String(plan.id_plan)} id={`plan-${plan.id_plan}`} className="peer sr-only" />
              <Label
                htmlFor={`plan-${plan.id_plan}`}
                className={cn(
                  "flex h-full flex-col gap-1 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 p-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  idPlan === String(plan.id_plan) && "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900"
                )}
              >
                <span className="font-bold">{plan.nombre}</span>
                <span className="text-sm text-muted-foreground font-normal">{formatCLP(plan.precio_mensual)}/mes</span>
                {pruebaDisponible && plan.es_plan_prueba && <span className="text-xs font-semibold">14 días gratis</span>}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {planes.find((p) => String(p.id_plan) === idPlan) && (
          <ul className="space-y-1">
            {caracteristicasPlan(planes.find((p) => String(p.id_plan) === idPlan)!).map((c) => (
              <li key={c} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 border-t pt-6">
        <p className="text-sm font-medium">Primera sucursal</p>
        <div className="space-y-2">
          <Label htmlFor="sucursal">Nombre de la sucursal</Label>
          <Input
            id="sucursal"
            placeholder="Casa matriz"
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            maxLength={80}
            disabled={enviando}
            className="h-11"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              placeholder="Av. Picarte 1234"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              required
              maxLength={120}
              disabled={enviando}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comuna">Comuna</Label>
            <Input
              id="comuna"
              placeholder="Valdivia"
              value={comuna}
              onChange={(e) => setComuna(e.target.value)}
              required
              maxLength={60}
              disabled={enviando}
              className="h-11"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="aceptaTerminos"
          checked={aceptaTerminos}
          onCheckedChange={(checked) => setAceptaTerminos(checked === true)}
          disabled={enviando}
          className="mt-0.5"
        />
        <Label htmlFor="aceptaTerminos" className="text-sm font-normal leading-snug">
          <span>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="underline underline-offset-4">términos de servicio</Link>
            {" "}y la{" "}
            <Link href="/privacidad" target="_blank" className="underline underline-offset-4">política de privacidad</Link>
            , incluido el tratamiento de los datos de mis clientes como encargado.
          </span>
        </Label>
      </div>

      <Button type="submit" className="w-full h-11 text-base" disabled={enviando || !idPlan || !aceptaTerminos}>
        {enviando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando tu barbería...
          </>
        ) : (
          "Crear mi barbería"
        )}
      </Button>
    </form>
  );
}
