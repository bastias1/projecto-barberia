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
    price: "$9.990",
    description:
      "Suaviza la barba, reduce el frizz y deja un aroma masculino clásico.",
    image: "/products/aceite-barba.jpg",
    tag: "Nuevo",
  },
  {
    id: 2,
    name: "Cera Mate BENJVMIN",
    category: "Styling",
    price: "$11.990",
    description:
      "Fijación media, acabado mate. Ideal para peinados naturales y texturizados.",
    image: "/products/cera-mate.jpg",
    tag: "Top venta",
  },
  {
    id: 3,
    name: "Shampoo para Barba & Cabello",
    category: "Cuidado",
    price: "$8.490",
    description:
      "Limpieza suave diaria, formulado para cuero cabelludo y barba.",
    image: "/products/shampoo-barba.jpg",
  },
  {
    id: 4,
    name: "Pack Premium BENJVMIN",
    category: "Pack",
    price: "$27.990",
    description: "Incluye cera, aceite y shampoo en un pack ideal para regalo.",
    image: "/products/pack-premium.jpg",
    tag: "Edición limitada",
  },
];

export default function StorePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 p-4 py-10">
      <main className="mx-auto w-full max-w-5xl">
        {/* Barra superior: volver + título */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al inicio</span>
          </Link>

          <div className="text-right">
            <p className="text-xs tracking-[0.35em] text-zinc-400 uppercase">
              Barbería · Profesional · Premium
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900">
              Tienda Online BENJVMIN
            </h1>
          </div>
        </header>

        {/* Filtros simples / categorías (solo visuales por ahora) */}
        <section className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-2 text-zinc-500">Categorías:</span>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800">
            Barba
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800">
            Cabello
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800">
            Styling
          </Badge>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800">
            Packs
          </Badge>
        </section>

        {/* Grid de productos */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card
              key={product.id}
              className="group overflow-hidden rounded-3xl border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Imagen (link al detalle) */}
              <Link href={`/tienda/${product.id}`}>
                <div className="relative h-40 w-full bg-zinc-100">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </Link>

              <CardHeader className="space-y-1 pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-zinc-900">
                    {product.name}
                  </CardTitle>
                  {product.tag && (
                    <Badge className="border-none bg-violet-100 text-[10px] text-violet-700">
                      {product.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{product.category}</p>
              </CardHeader>

              <CardContent className="space-y-4 pb-5">
                <p className="text-sm leading-relaxed text-zinc-600">
                  {product.description}
                </p>

                {/* Precio + mini rating visual */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-zinc-900">
                    {product.price}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-amber-500">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span>4.8</span>
                  </div>
                </div>

                {/* Etiquetas de tipo de producto con iconos */}
                <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  {product.category === "Barba" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1">
                      <Droplets className="h-3 w-3" /> Hidratación
                    </span>
                  )}
                  {product.category === "Styling" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1">
                      <Scissors className="h-3 w-3" /> Peinado
                    </span>
                  )}
                  {product.category === "Pack" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1">
                      <ShoppingCart className="h-3 w-3" /> Pack ahorro
                    </span>
                  )}
                </div>

                {/* Botones: detalle + agregar al carrito */}
                <div className="mt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-center text-sm"
                    asChild
                  >
                    <Link href={`/tienda/${product.id}`}>Ver detalle</Link>
                  </Button>

                  <AddToCartButton
                    id={product.id}
                    name={product.name}
                    priceLabel={product.price}
                    image={product.image}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
        <header className="mb-8 flex items-center justify-between gap-4">
        <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al inicio</span>
        </Link>

        <div className="flex items-center gap-4">
            <div className="text-right">
            <p className="text-xs tracking-[0.35em] text-zinc-400 uppercase">
                Barbería · Profesional · Premium
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900">
                Tienda Online BENJVMIN
            </h1>
        </div>

            {/* Botón de carrito */}
            <CartButton />
        </div>
        </header>

        {/* Pie pequeño */}
        <footer className="mt-10 text-center text-xs text-zinc-500">
          Productos demostrativos para el prototipo del sistema Barbería
          BENJVMIN.
        </footer>
      </main>
    </div>
  );
}
