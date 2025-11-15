// app/tienda/page.tsx
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, ArrowLeft, Star, Droplets, Scissors } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { CartButton } from "@/components/cart-button";

const products = [
  {
    id: 1,
    name: "Aceite para Barba Classic",
    category: "Barba",
    price: 9990,
    priceLabel: "$9.990",
    description:
      "Suaviza la barba, reduce el frizz y deja un aroma masculino clásico.",
    image: "/products/aceite-barba.jpg",
    tag: "Nuevo",
  },
  {
    id: 2,
    name: "Cera Mate BENJVMIN",
    category: "Styling",
    price: 11990,
    priceLabel: "$11.990",
    description:
      "Fijación media, acabado mate. Ideal para peinados naturales y texturizados.",
    image: "/products/cera-mate.jpg",
    tag: "Top venta",
  },
  {
    id: 3,
    name: "Shampoo para Barba & Cabello",
    category: "Cuidado",
    price: 8490,
    priceLabel: "$8.490",
    description:
      "Limpieza suave diaria, formulado para cuero cabelludo y barba.",
    image: "/products/shampoo-barba.jpg",
  },
  {
    id: 4,
    name: "Pack Premium BENJVMIN",
    category: "Pack",
    price: 27990,
    priceLabel: "$27.990",
    description: "Incluye cera, aceite y shampoo en un pack ideal para regalo.",
    image: "/products/pack-premium.jpg",
    tag: "Edición limitada",
  },
];

export default function StorePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-12">
      <main className="mx-auto w-full max-w-5xl">

        {/* Barra superior: volver + título + carrito */}
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al inicio</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs tracking-[0.35em] text-zinc-400 uppercase dark:text-zinc-500">
                Barbería · Profesional · Premium
              </p>
              <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Tienda Online BENJVMIN
              </h1>
            </div>

            {/* Carrito arriba a la derecha */}
            <CartButton />
          </div>
        </header>

        {/* Filtros simples */}
        <section className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-2 text-zinc-500 dark:text-zinc-400">Categorías:</span>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Barba
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Cabello
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Styling
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Packs
          </Badge>
        </section>

        {/* Grid de productos */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card
              key={product.id}
              className="group overflow-hidden rounded-3xl border-2 border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-700"
            >
              {/* Imagen */}
              <Link href={`/tienda/${product.id}`}>
                <div className="relative h-40 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </Link>

              <CardHeader className="space-y-1 pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {product.name}
                  </CardTitle>
                  {product.tag && (
                    <Badge className="border-none bg-violet-100 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 shrink-0">
                      {product.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{product.category}</p>
              </CardHeader>

              <CardContent className="space-y-4 pb-5">
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-2">
                  {product.description}
                </p>

                {/* Precio + rating */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {product.priceLabel}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-amber-500">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span className="font-semibold">4.8</span>
                  </div>
                </div>

                {/* Iconos por categoría */}
                <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {product.category === "Barba" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      <Droplets className="h-3 w-3" /> Hidratación
                    </span>
                  )}
                  {product.category === "Styling" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      <Scissors className="h-3 w-3" /> Peinado
                    </span>
                  )}
                  {product.category === "Pack" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      <ShoppingCart className="h-3 w-3" /> Pack ahorro
                    </span>
                  )}
                </div>

                {/* Botones */}
                <div className="mt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    asChild
                  >
                    <Link href={`/tienda/${product.id}`}>Ver detalle</Link>
                  </Button>

                  <AddToCartButton
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    priceLabel={product.priceLabel}
                    image={product.image}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Pie de página */}
        <footer className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Productos demostrativos para el prototipo del sistema Barbería BENJVMIN.
        </footer>
      </main>
    </div>
  );
}