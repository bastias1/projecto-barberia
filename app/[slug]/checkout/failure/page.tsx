"use client";

import Link from "next/link";
import { useBarberia } from "@/components/barberia-provider";
import { XCircle, RefreshCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentFailurePage() {
    const { slug } = useBarberia();
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-red-100 to-zinc-100 dark:from-red-950/30 dark:via-zinc-900 dark:to-black p-4">
            <Card className="w-full max-w-md border-2 border-red-100 dark:border-red-900/50 shadow-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
                <CardContent className="pt-10 pb-8 px-6 flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-200 dark:bg-red-900/50 rounded-full blur-xl opacity-50 animate-pulse" />
                        <div className="relative bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                            <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                            Algo salió mal
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            No pudimos procesar tu pago. Por favor, intenta nuevamente o usa otro método de pago.
                        </p>
                    </div>

                    <div className="w-full space-y-3 pt-4">
                        <Link href={`/${slug}/checkout`} className="w-full block">
                            <Button className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base rounded-xl">
                                <RefreshCcw className="mr-2 h-5 w-5" />
                                Intentar nuevamente
                            </Button>
                        </Link>
                        <Link href={`/${slug}/tienda`} className="w-full block">
                            <Button variant="ghost" className="w-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver a la tienda
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
