"use client";

import Link from "next/link";
import { useBarberia } from "@/components/barberia-provider";
import { Clock, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Vidrio } from "@/components/vidrio";

export default function PaymentPendingPage() {
    const { slug } = useBarberia();
    return (
        <main id="contenido" className="flex min-h-[70vh] items-center justify-center">
            <div className="w-full max-w-md space-y-6 tarjeta rounded-2xl border border-border bg-card p-8 text-center">
              <Vidrio />
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
                    <Clock className="size-7 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                    <h1 className="display text-3xl">Pago pendiente</h1>
                    <p className="text-muted-foreground">
                        Estamos procesando tu pago. Te avisaremos por correo cuando se complete.
                    </p>
                </div>
                <Button asChild className="h-12 w-full text-base">
                    <Link href={`/${slug}/tienda`}><ShoppingBag className="size-4" aria-hidden="true" />Volver a la tienda</Link>
                </Button>
            </div>
        </main>
    );
}
