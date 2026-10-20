"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { useBarberiaHref } from "@/components/barberia-provider";

interface Product {
    id: string | number;
    nombre: string;
    precio: number;
    imagen_url: string | null;
    categoria: string;
    descripcion: string | null;
    tag?: string | null;
    stock: number;
}

interface ProductCarouselProps {
    products: Product[];
}

export function ProductCarousel({ products }: ProductCarouselProps) {
    const href = useBarberiaHref();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300; // Adjust scroll amount as needed
            const newScrollLeft =
                direction === "left"
                    ? scrollContainerRef.current.scrollLeft - scrollAmount
                    : scrollContainerRef.current.scrollLeft + scrollAmount;

            scrollContainerRef.current.scrollTo({
                left: newScrollLeft,
                behavior: "smooth",
            });
        }
    };

    if (!products || products.length === 0) return null;

    return (
        <div className="relative group">
            <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                onClick={() => scroll("left")}
            >
                <ChevronLeft className="h-5 w-5" />
            </Button>

            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory px-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="min-w-[260px] max-w-[260px] snap-start"
                    >
                        <Card className="h-full overflow-hidden rounded-xl border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow dark:border-zinc-800 dark:bg-zinc-900">
                            <Link href={href(`/tienda/${product.id}`)} className="block relative h-48 bg-zinc-100 dark:bg-zinc-800">
                                <Image
                                    src={product.imagen_url || "/placeholder.svg"}
                                    alt={product.nombre}
                                    fill
                                    className="object-cover"
                                />
                            </Link>
                            <CardContent className="p-4">
                                <Link href={href(`/tienda/${product.id}`)}>
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-1 hover:text-blue-600 transition-colors">
                                        {product.nombre}
                                    </h3>
                                </Link>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 truncate">
                                    {product.categoria}
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                        ${product.precio.toLocaleString("es-CL")}
                                    </span>
                                    <AddToCartButton
                                        id={product.id}
                                        name={product.nombre}
                                        price={product.precio}
                                        priceLabel={`$${product.precio.toLocaleString("es-CL")}`}
                                        stock={product.stock}
                                        image={product.imagen_url || "/placeholder.svg"}
                                        size="sm"
                                        fullWidth={false}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>

            <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                onClick={() => scroll("right")}
            >
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    );
}
