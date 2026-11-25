"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Product } from "@/lib/services/product-service";
import { useBarberiaHref } from "@/components/barberia-provider";
import { cn } from "@/lib/utils";

interface StoreClientProps {
    products: Product[];
}

const TODOS = "Todos";

export function StoreClient({ products }: StoreClientProps) {
    const href = useBarberiaHref();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const consulta = searchParams.get("q");

    // La categoría vive en la URL (?categoria=): se puede compartir y funciona con el botón Atrás
    const categories = useMemo(() => [TODOS, ...new Set(products.map((p) => p.categoria))], [products]);
    const pedida = searchParams.get("categoria") ?? TODOS;
    const selectedCategory = categories.includes(pedida) ? pedida : TODOS;

    const filteredProducts = useMemo(
        () => (selectedCategory === TODOS ? products : products.filter((p) => p.categoria === selectedCategory)),
        [products, selectedCategory],
    );

    const elegirCategoria = (categoria: string) => {
        const params = new URLSearchParams(searchParams);
        if (categoria === TODOS) params.delete("categoria");
        else params.set("categoria", categoria);
        router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    };

    return (
        <main id="contenido">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
                <h1 className="display text-3xl sm:text-4xl">Tienda</h1>
                <p className="tabular text-sm text-muted-foreground" role="status">
                    {filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}
                    {consulta ? ` para "${consulta}"` : ""}
                </p>
            </div>

            {categories.length > 2 && (
                <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Categorías">
                    <div className="flex gap-2 sm:flex-wrap">
                        {categories.map((category) => (
                            <Button
                                key={category}
                                variant={selectedCategory === category ? "default" : "outline"}
                                aria-pressed={selectedCategory === category}
                                className="h-11 shrink-0 rounded-full px-4"
                                onClick={() => elegirCategoria(category)}
                            >
                                {category}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center">
                    <PackageSearch className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-semibold">No encontramos productos</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {consulta ? "Prueba con otra búsqueda o revisa otra categoría." : "Esta categoría aún no tiene productos."}
                    </p>
                </div>
            ) : (
                <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((product) => {
                        const agotado = product.stock <= 0;
                        return (
                            <li key={product.id} className="lift group flex flex-col overflow-hidden tarjeta rounded-2xl border border-border bg-card">
                                <Link href={href(`/tienda/${product.id}`)} className="relative block aspect-square overflow-hidden bg-muted">
                                    <Image
                                        src={product.imagen_url || "/placeholder.svg"}
                                        alt={product.nombre}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                        className={cn("object-cover transition-transform duration-500 group-hover:scale-[1.03]", agotado && "opacity-50")}
                                    />
                                    {(agotado || product.tag) && (
                                        <span className="absolute left-2 top-2 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                                            {agotado ? "Agotado" : product.tag}
                                        </span>
                                    )}
                                </Link>

                                <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs text-muted-foreground">{product.categoria}</p>
                                        <Link href={href(`/tienda/${product.id}`)} className="mt-0.5 line-clamp-2 font-semibold leading-snug hover:underline underline-offset-4">
                                            {product.nombre}
                                        </Link>
                                    </div>
                                    <div className="mt-auto space-y-3">
                                        <p className="tabular text-lg font-semibold">${product.precio.toLocaleString("es-CL")}</p>
                                        <AddToCartButton
                                            id={product.id}
                                            name={product.nombre}
                                            price={product.precio}
                                            priceLabel={`$${product.precio.toLocaleString("es-CL")}`}
                                            stock={product.stock}
                                            image={product.imagen_url || "/placeholder.svg"}
                                        />
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
