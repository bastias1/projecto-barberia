import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Star, Droplets, Scissors } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getProductById } from "@/lib/services/product-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const productId = Number(id);

  const product = await getProductById(productId);

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-10">
        <main className="mx-auto w-full max-w-3xl text-center">
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Producto no encontrado.</p>
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
        </main>
      </div>
    );
  }

  const priceLabel = `$${product.precio.toLocaleString("es-CL")}`;
  const imageUrl = product.imagen_url || "/placeholder.png";

  // Parse details if stored as JSON string or array, otherwise use default or split description
  // Assuming details might not be in the DB schema yet, we'll use a placeholder or derived data
  const details = [
    "Calidad profesional garantizada",
    "Ideal para uso diario",
    "Producto exclusivo de Barbería BENJVMIN"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-10">
      <main className="mx-auto w-full max-w-4xl">
        {/* Barra superior */}
        <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la tienda</span>
          </Link>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-500">
              Barbería · Profesional · Premium
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Detalle de producto
            </h1>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="grid items-start gap-8 md:grid-cols-[1.2fr,1fr]">
          {/* Imagen grande */}
          <Card className="overflow-hidden rounded-3xl border-2 border-zinc-200 bg-white shadow-sm hover:shadow-xl transition-shadow duration-300 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="relative h-64 w-full bg-zinc-100 dark:bg-zinc-800 md:h-80">
              <Image
                src={imageUrl}
                alt={product.nombre}
                fill
                className="object-cover"
                priority
              />
            </div>
          </Card>

          {/* Info del producto */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {product.categoria}
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {product.nombre}
                </h2>
              </div>

              <div className="text-right flex flex-col items-end gap-2">
                {product.tag && (
                  <Badge className="border-none bg-violet-100 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    {product.tag}
                  </Badge>
                )}

                {product.rating && (
                  <div className="inline-flex items-center gap-1 text-xs text-amber-500">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span className="font-semibold">{product.rating}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {product.descripcion}
            </p>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Precio</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {priceLabel}
                </p>
              </div>

              <AddToCartButton
                id={product.id}
                name={product.nombre}
                price={product.precio}
                priceLabel={priceLabel}
                image={imageUrl}
                fullWidth={false}
              />
            </div>

            {/* Características */}
            <Card className="mt-4 border-2 border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Beneficios principales
                </p>

                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {details.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Etiquetas según categoría */}
                <div className="flex flex-wrap gap-2 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {product.categoria === "Barba" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      <Droplets className="h-3 w-3" /> Hidratación
                    </span>
                  )}
                  {product.categoria === "Styling" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      <Scissors className="h-3 w-3" /> Peinado
                    </span>
                  )}
                  {product.categoria === "Pack" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      <ShoppingCart className="h-3 w-3" /> Pack completo
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pie simple */}
        <p className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Esta página representa el detalle de producto del prototipo de E-Commerce de Barbería BENJVMIN.
        </p>
      </main>
    </div>
  );
}