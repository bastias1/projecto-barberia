"use client";

import Link from "next/link";
import { useBarberia } from "@/components/barberia-provider";
import { XCircle, RefreshCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentFailurePage() {
    const { slug } = useBarberia();
    return (
        <main id="contenido" className="flex min-h-[70vh] items-center justify-center">
            <div className="w-full max-w-md space-y-6 tarjeta rounded-2xl border border-border bg-card p-8 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <XCircle className="size-7" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                    <h1 className="display text-3xl">No pudimos procesar el pago</h1>
                    <p className="text-muted-foreground">
                        No se hizo ningún cobro. Intenta de nuevo o usa otra tarjeta.
                    </p>
                </div>
                <div className="space-y-3">
                    <Button asChild className="h-12 w-full text-base">
                        <Link href={`/${slug}/checkout`}><RefreshCcw className="size-4" aria-hidden="true" />Intentar nuevamente</Link>
                    </Button>
                    <Button asChild variant="ghost" className="h-11 w-full">
                        <Link href={`/${slug}/tienda`}><ArrowLeft className="size-4" aria-hidden="true" />Volver a la tienda</Link>
                    </Button>
                </div>
            </div>
        </main>
    );
}
