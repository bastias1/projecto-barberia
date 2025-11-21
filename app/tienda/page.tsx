import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Droplets, Scissors, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { CartButton } from "@/components/cart-button";
import { getProducts } from "@/lib/services/product-service";

import { StoreHeader } from "@/components/shop/store-header";
import { ProductCarousel } from "@/components/shop/product-carousel";

export const dynamic = 'force-dynamic';

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q;
  const products = await getProducts(query);

  return (
    <div className="relative bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black text-zinc-900 dark:text-zinc-100 min-h-screen">
      <div className="relative z-30 max-w-[1600px] mx-auto px-6 py-8 md:py-12">
        <StoreHeader />

        <div className="flex flex-col items-center text-center space-y-6 mb-10">


          {/* Carousel */}
          <div className="w-full">
            <ProductCarousel products={products} />
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Catálogo <span className="text-blue-400">Completo</span>
            </h1>
            <p className="text-base text-zinc-700 dark:text-zinc-400">
              Explora nuestra colección de productos premium para el cuidado personal.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-6 py-8 -mt-8 relative z-20">

        {/* Grid de productos */}
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">No hay productos disponibles en este momento.</p>
          </div>
        ) : (
          <section className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const priceLabel = `$${product.precio.toLocaleString("es-CL")}`;
              const imageUrl = product.imagen_url || "/placeholder.png";

              return (
                <Card
                  key={product.id}
                  className="group relative overflow-hidden rounded-xl border-zinc-200 bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Badge Flotante */}
                  {product.tag && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-blue-600 text-white border-none shadow-md text-xs px-2 py-0.5">
                        {product.tag}
                      </Badge>
                    </div>
                  )}

                  {/* Imagen */}
                  <Link href={`/tienda/${product.id}`} className="block overflow-hidden">
                    <div className="relative h-48 w-full bg-zinc-100 dark:bg-zinc-800">
                      <Image
                        src={imageUrl}
                        alt={product.nombre}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* Overlay gradiente al hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </Link>

                  <CardContent className="p-6">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          {product.categoria}
                        </span>
                        {product.rating && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{product.rating}</span>
                          </div>
                        )}
                      </div>

                      <Link href={`/tienda/${product.id}`}>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {product.nombre}
                        </h3>
                      </Link>

                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 h-10">
                        {product.descripcion}
                      </p>
                    </div>

                    {/* Iconos de características */}
                    <div className="flex gap-3 mb-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      {product.categoria === "Barba" && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Droplets className="h-3.5 w-3.5 text-blue-500" />
                          <span>Hidratante</span>
                        </div>
                      )}
                      {product.categoria === "Styling" && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Scissors className="h-3.5 w-3.5 text-orange-500" />
                          <span>Fijación</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Premium</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 line-through opacity-0 group-hover:opacity-100 transition-opacity">
                          ${(product.precio * 1.2).toFixed(0)}
                        </span>
                        <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {priceLabel}
                        </span>
                      </div>

                      <div className="flex-1 max-w-[140px]">
                        <AddToCartButton
                          id={product.id}
                          name={product.nombre}
                          price={product.precio}
                          priceLabel={priceLabel}
                          image={imageUrl}
                          fullWidth={true}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        <footer className="mt-16 text-center border-t border-zinc-200 dark:border-zinc-800 pt-8">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            © 2024 Barbería BENJVMIN. Todos los derechos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
}
