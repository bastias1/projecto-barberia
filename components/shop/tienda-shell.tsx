import { Suspense } from "react";
import { StoreHeader } from "@/components/shop/store-header";
import { RequiereModulo } from "@/components/requiere-modulo";

/** Estructura común de tienda, carrito y checkout: solo existe si el plan incluye el módulo ecommerce. */
export function TiendaShell({ children }: { children: React.ReactNode }) {
  return (
    <RequiereModulo modulo="ecommerce">
      <div className="min-h-dvh bg-background text-foreground">
        <Suspense fallback={<div className="h-16 border-b border-border" />}>
          <StoreHeader />
        </Suspense>
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</div>
      </div>
    </RequiereModulo>
  );
}
