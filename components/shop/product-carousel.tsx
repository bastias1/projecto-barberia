"use client";

import Image from "next/image";
import Link from "next/link";
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

/** Fila de productos que se desliza con el dedo o la rueda; sin controles que dependan del hover. */
export function ProductCarousel({ products }: ProductCarouselProps) {
    const href = useBarberiaHref();

    if (!products || products.length === 0) return null;

    return (
        <ul className="-mx-4 -my-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-6 sm:-mx-6 sm:scroll-px-6 sm:px-6" tabIndex={0} aria-label="Productos">
            {products.map((product) => (
                <li key={product.id} className="lift group w-56 shrink-0 snap-start overflow-hidden tarjeta rounded-2xl">
                    <Link href={href(`/tienda/${product.id}`)} className="relative block h-44 overflow-hidden bg-muted">
                        <Image
                            src={product.imagen_url || "/placeholder.svg"}
                            alt={product.nombre}
                            fill
                            sizes="224px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                    </Link>
                    <div className="space-y-3 p-4">
                        <div className="min-w-0">
                            <Link href={href(`/tienda/${product.id}`)} className="block truncate font-semibold hover:underline underline-offset-4">
                                {product.nombre}
                            </Link>
                            <p className="truncate text-sm text-muted-foreground">{product.categoria}</p>
                        </div>
                        <p className="tabular font-semibold">${product.precio.toLocaleString("es-CL")}</p>
                        <AddToCartButton
                            id={product.id}
                            name={product.nombre}
                            price={product.precio}
                            priceLabel={`$${product.precio.toLocaleString("es-CL")}`}
                            stock={product.stock}
                            image={product.imagen_url || "/placeholder.svg"}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}
