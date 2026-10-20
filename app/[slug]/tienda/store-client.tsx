"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { HeroSection } from "@/components/shop/hero-section";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Filter } from "lucide-react";
import { Product } from "@/lib/services/product-service";
import { useBarberiaHref } from "@/components/barberia-provider";

interface StoreClientProps {
    products: Product[];
}

export function StoreClient({ products }: StoreClientProps) {
    const href = useBarberiaHref();
    const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

    // Extract unique categories
    const categories = useMemo(() => {
        const cats = new Set(products.map((p) => p.categoria));
        return ["Todos", ...Array.from(cats)];
    }, [products]);

    // Filter products
    const filteredProducts = useMemo(() => {
        if (selectedCategory === "Todos") return products;
        return products.filter((p) => p.categoria === selectedCategory);
    }, [products, selectedCategory]);

    return (
        <>
            <HeroSection />

            <div className="flex flex-col md:flex-row gap-8 mt-12">
                {/* Sidebar Filters */}
                <aside className="w-full md:w-64 flex-shrink-0">
                    <div className="sticky top-24 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="h-5 w-5" />
                            <h2 className="font-bold text-lg">Categorías</h2>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
                            {categories.map((category) => (
                                <Button
                                    key={category}
                                    variant={selectedCategory === category ? "default" : "ghost"}
                                    className={`justify-start ${selectedCategory === category
                                        ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        }`}
                                    onClick={() => setSelectedCategory(category)}
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Product Grid */}
                <main className="flex-1">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">
                            {selectedCategory === "Todos" ? "Todos los Productos" : selectedCategory}
                        </h2>
                        <span className="text-sm text-zinc-500">
                            {filteredProducts.length} productos
                        </span>
                    </div>

                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-500">No se encontraron productos en esta categoría.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {filteredProducts.map((product) => (
                                <Card
                                    key={product.id}
                                    className="group relative overflow-hidden rounded-xl border-zinc-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900"
                                >
                                    {/* Badge */}
                                    {product.tag && (
                                        <div className="absolute top-3 right-3 z-10">
                                            <Badge className="bg-black text-white dark:bg-white dark:text-black border-none shadow-sm">
                                                {product.tag}
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Image */}
                                    <Link href={href(`/tienda/${product.id}`)} className="block relative aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        <Image
                                            src={product.imagen_url || "/placeholder.svg"}
                                            alt={product.nombre}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    </Link>

                                    <CardContent className="p-5">
                                        <div className="mb-3">
                                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                                {product.categoria}
                                            </p>
                                            <Link href={href(`/tienda/${product.id}`)}>
                                                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-blue-600 transition-colors">
                                                    {product.nombre}
                                                </h3>
                                            </Link>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                                            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                                                ${product.precio.toLocaleString("es-CL")}
                                            </span>
                                            <div className="flex-shrink-0">
                                                <AddToCartButton
                                                    id={product.id}
                                                    name={product.nombre}
                                                    price={product.precio}
                                                    priceLabel={`$${product.precio.toLocaleString("es-CL")}`}
                                                    stock={product.stock}
                                                    image={product.imagen_url || "/placeholder.svg"}
                                                    size="sm"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
