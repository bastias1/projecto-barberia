"use client";

import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { BarberiaNavbar } from "@/components/barberia-navbar";
import { BarberSelection } from "@/components/booking/barber-selection";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { AccionesPaso } from "@/components/booking/acciones-paso";
import { StoreHeader } from "@/components/shop/store-header";
import { StoreClient } from "@/app/[slug]/tienda/store-client";
import { Button } from "@/components/ui/button";
import type { Barbero } from "@/lib/services/barber-service";
import type { Product } from "@/lib/services/product-service";

// Reservar y Tienda en la vista previa de Apariencia: los componentes reales con datos de ejemplo, sin consultar la base

const BARBEROS: Barbero[] = [
  { id: "a", nombre: "Alex Ejemplo", especialidad: "Degradados", profile_image: null },
  { id: "b", nombre: "Sam Ejemplo", especialidad: "Barba y corte clásico", profile_image: null },
];

const PRODUCTOS: Product[] = [
  ["Cera mate", "Peinado", 11990],
  ["Aceite para barba", "Barba", 14990],
  ["Shampoo", "Cuidado", 9990],
  ["Peine de madera", "Accesorios", 6990],
].map(([nombre, categoria, precio], i) => ({
  id: -1 - i, nombre: nombre as string, categoria: categoria as string, precio: precio as number,
  descripcion: null, imagen_url: null, stock: 10, created_at: "",
}));

function Reserva() {
  return (
    <div className="min-h-dvh bg-background">
      <BarberiaNavbar ancho="max-w-2xl" />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h1 className="display mb-5 text-3xl sm:text-4xl">Agendar cita</h1>
        <ProgressSteps currentStep={1} />
        <BarberSelection barbers={BARBEROS} selectedBarber={BARBEROS[0]} onBarberSelect={() => {}} />
        <AccionesPaso>
          <Button>Continuar<ArrowRight className="size-4" aria-hidden="true" /></Button>
        </AccionesPaso>
      </main>
    </div>
  );
}

function Tienda() {
  return (
    <Suspense>
      <div className="min-h-dvh bg-background text-foreground">
        <StoreHeader />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
          <StoreClient products={PRODUCTOS} />
        </div>
      </div>
    </Suspense>
  );
}

export function Muestra({ pagina }: { pagina: "reserva" | "tienda" }) {
  return pagina === "reserva" ? <Reserva /> : <Tienda />;
}
