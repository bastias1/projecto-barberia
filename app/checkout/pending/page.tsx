"use client";

import Link from "next/link";
import { Clock, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentPendingPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-yellow-100 to-zinc-100 dark:from-yellow-950/30 dark:via-zinc-900 dark:to-black p-4">
            <Card className="w-full max-w-md border-2 border-yellow-100 dark:border-yellow-900/50 shadow-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
                <CardContent className="pt-10 pb-8 px-6 flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-yellow-200 dark:bg-yellow-900/50 rounded-full blur-xl opacity-50 animate-pulse" />
                        <div className="relative bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full">
                            <Clock className="w-16 h-16 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                            Pago Pendiente
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Estamos procesando tu pago. Te notificaremos cuando se complete la transacción.
                        </p>
                    </div>

                    <div className="w-full space-y-3 pt-4">
                        <Link href="/tienda" className="w-full block">
                            <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white h-12 text-base rounded-xl group">
                                <ShoppingBag className="mr-2 h-5 w-5" />
                                Volver a la tienda
                                <ArrowRight className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
