"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberiaHref } from "@/components/barberia-provider";
import { Button } from "@/components/ui/button";

import { ProductCarousel } from "@/components/shop/product-carousel";

import { Product } from "@/lib/services/product-service";

interface CartClientProps {
    products: Product[];
}

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

export function CartClient({ products }: CartClientProps) {
    const href = useBarberiaHref();
    const { items: cart, removeItem, updateQuantity } = useBarberiaCart();

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cart.length === 0)
        return (
            <main id="contenido" className="text-center">
                <div className="mx-auto max-w-md py-12">
                    <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted"><ShoppingBag className="size-6 text-muted-foreground" aria-hidden="true" /></span>
                    <h1 className="display text-3xl">Tu carrito está vacío</h1>
                    <p className="mt-2 text-muted-foreground">Agrega productos desde la tienda.</p>
                    <Button asChild className="mt-6 h-12 px-6">
                        <Link href={href("/tienda")}>Ir a la tienda</Link>
                    </Button>
                </div>
                {products.length > 0 && (
                    <div className="mt-8 text-left">
                        <h2 className="display mb-6 text-2xl">Quizás te interese</h2>
                        <ProductCarousel products={products} />
                    </div>
                )}
            </main>
        );

    return (
        <main id="contenido" className="pb-28 md:pb-0">
            <h1 className="display mb-6 text-3xl sm:text-4xl">Tu carrito</h1>

            <div className="grid gap-8 md:grid-cols-3">
                <ul className="space-y-3 md:col-span-2">
                    {cart.map((item) => (
                        <li key={item.id} className="flex gap-4 tarjeta rounded-2xl border border-border bg-card p-4">
                            {item.image && (
                                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                                    <Image src={item.image} alt="" fill sizes="96px" className="object-cover" />
                                </div>
                            )}
                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="line-clamp-2 font-semibold">{item.name}</h2>
                                        <p className="tabular text-sm text-muted-foreground">{item.priceLabel}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        className="-mr-2 -mt-2 size-11 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeItem(item.id)}
                                        aria-label={`Quitar ${item.name} del carrito`}
                                    >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center rounded-lg border border-border" role="group" aria-label={`Cantidad de ${item.name}`}>
                                        <Button
                                            variant="ghost"
                                            className="size-11 p-0"
                                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                            disabled={item.quantity <= 1}
                                            aria-label="Una unidad menos"
                                        >
                                            <Minus className="size-4" aria-hidden="true" />
                                        </Button>
                                        <span className="tabular w-8 text-center font-medium" aria-live="polite">{item.quantity}</span>
                                        <Button
                                            variant="ghost"
                                            className="size-11 p-0"
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            disabled={item.stock ? item.quantity >= item.stock : false}
                                            aria-label="Una unidad más"
                                        >
                                            <Plus className="size-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                    <p className="tabular font-semibold">{clp(item.price * item.quantity)}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>

                <aside className="md:col-span-1">
                    <div className="space-y-5 tarjeta rounded-2xl border border-border bg-card p-6 md:sticky md:top-24">
                        <h2 className="text-lg font-semibold">Resumen</h2>
                        <dl className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex justify-between"><dt>Subtotal (sin IVA)</dt><dd className="tabular">{clp(Math.round(total / 1.19))}</dd></div>
                            <div className="flex justify-between"><dt>IVA (19%)</dt><dd className="tabular">{clp(Math.round(total - total / 1.19))}</dd></div>
                        </dl>
                        <div className="border-t border-border pt-4">
                            <div className="flex items-end justify-between">
                                <span className="font-medium">Total</span>
                                <span className="tabular text-2xl font-semibold">{clp(total)}</span>
                            </div>
                            <p className="mt-1 text-right text-xs text-muted-foreground">Precios con IVA incluido</p>
                        </div>
                        <Button className="hidden h-12 w-full text-base md:inline-flex" asChild>
                            <Link href={href("/checkout")}>Ir a pagar</Link>
                        </Button>
                    </div>
                </aside>
            </div>

            {/* Barra fija en teléfono: total y pago siempre a mano */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                    <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="tabular text-xl font-semibold">{clp(total)}</p>
                    </div>
                    <Button className="h-12 flex-1 text-base" asChild>
                        <Link href={href("/checkout")}>Ir a pagar</Link>
                    </Button>
                </div>
            </div>

            <div className="mt-16">
                <h2 className="display mb-6 text-2xl">Completa tu rutina</h2>
                <ProductCarousel products={products} />
            </div>
        </main>
    );
}
