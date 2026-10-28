"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberiaHref } from "@/components/barberia-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ProductCarousel } from "@/components/shop/product-carousel";

import { Product } from "@/lib/services/product-service";

interface CartClientProps {
    products: Product[];
}

export function CartClient({ products }: CartClientProps) {
    const href = useBarberiaHref();
    const { items: cart, removeItem, updateQuantity } = useBarberiaCart();

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cart.length === 0)
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center min-h-[60vh]">
                <p className="text-lg sm:text-xl text-zinc-700 dark:text-zinc-300 mb-6">
                    Tu carrito está vacío.
                </p>
                <Button asChild>
                    <Link href={href("/tienda")}>Ir a comprar</Link>
                </Button>

                {/* Upsell Carousel for Empty Cart */}
                <div className="w-full mt-12">
                    <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100 text-center">
                        Quizás te interese
                    </h2>
                    <ProductCarousel products={products} />
                </div>
            </div>
        );

    return (
        <main id="contenido" className="mx-auto w-full max-w-6xl px-4 pb-10">
            <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Tu Carrito
            </h1>

            <div className="grid gap-8 md:grid-cols-3">
                {/* Cart Items List */}
                <div className="md:col-span-2 space-y-4">
                    {cart.map((item) => (
                        <Card
                            key={item.id}
                            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
                        >
                            <CardContent className="p-4 flex gap-4">
                                {item.image && (
                                    <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                            {item.name}
                                        </h2>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            {item.priceLabel}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-md hover:bg-white dark:hover:bg-zinc-700"
                                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-md hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-50"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                disabled={item.stock ? item.quantity >= item.stock : false}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            onClick={() => removeItem(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Order Summary */}
                <div className="md:col-span-1">
                    <Card className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 sticky top-4">
                        <CardContent className="p-6 space-y-6">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Resumen</h3>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                                    <span>Subtotal (sin IVA)</span>
                                    <span>${Math.round(total / 1.19).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                                    <span>IVA (19%)</span>
                                    <span>${Math.round(total - (total / 1.19)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                                    <span>Envío</span>
                                    <span className="text-right">Calculado al pagar</span>
                                </div>
                            </div>

                            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">Total</span>
                                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">${total.toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
                                    * Precios incluyen IVA
                                </p>
                            </div>

                            <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 h-12 text-lg rounded-xl" asChild>
                                <Link href={href("/checkout")}>
                                    Ir a Pagar
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Upsell Carousel */}
            <div className="mt-16">
                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
                    Completa tu rutina
                </h2>
                <ProductCarousel products={products} />
            </div>
        </main>
    );
}
