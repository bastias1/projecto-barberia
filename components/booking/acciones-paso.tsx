"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra fija al pie con Atrás y la acción principal del paso (48px, respeta la zona segura del iPhone).
 * `children` es el botón principal; el contenido de la página debe dejar `pb-28` para no quedar tapado.
 */
export function AccionesPaso({ onBack, backLabel = "Atrás", children }: { onBack?: () => void; backLabel?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="h-12 px-4">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Button>
        )}
        <div className="min-w-0 flex-1 [&>button]:h-12 [&>button]:w-full">{children}</div>
      </div>
    </div>
  );
}
