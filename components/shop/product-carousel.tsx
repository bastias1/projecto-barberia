"use client"

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface Product {
    id: number
    nombre: string
    descripcion: string | null
    precio: number
    imagen_url: string | null
    categoria: string
    tag?: string
}

interface ProductCarouselProps {
    products: Product[]
}

export function ProductCarousel({ products }: ProductCarouselProps) {
    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: true })
    )

    // Filter for featured products or just take the first 5
    const featuredProducts = products.slice(0, 5)

    if (featuredProducts.length === 0) return null

    return (
        <Carousel
            plugins={[plugin.current]}
            className="w-full max-w-5xl mx-auto"
            onMouseEnter={plugin.current.stop}
            onMouseLeave={plugin.current.reset}
        >
            <CarouselContent>
                {featuredProducts.map((product) => (
                    <CarouselItem key={product.id}>
                        <div className="p-1">
                            <Card className="border-none shadow-none bg-transparent">
                                <CardContent className="flex flex-col md:flex-row items-center justify-center p-6 gap-8">
                                    {/* Image Section */}
                                    <div className="relative w-full md:w-1/2 aspect-square md:aspect-[4/3] max-h-[400px] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        <Image
                                            src={product.imagen_url || "/placeholder.png"}
                                            alt={product.nombre}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                    </div>

                                    {/* Content Section */}
                                    <div className="w-full md:w-1/2 text-center md:text-left space-y-4">
                                        <Badge className="bg-blue-600 text-white border-none px-3 py-1 text-sm">
                                            Destacado
                                        </Badge>
                                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                            {product.nombre}
                                        </h2>
                                        <p className="text-lg text-zinc-600 dark:text-zinc-400 line-clamp-3">
                                            {product.descripcion}
                                        </p>
                                        <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                                            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                                                ${product.precio.toLocaleString("es-CL")}
                                            </span>
                                            <Link href={`/tienda/${product.id}`}>
                                                <Button size="lg" className="gap-2">
                                                    Ver Producto <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
        </Carousel>
    )
}
