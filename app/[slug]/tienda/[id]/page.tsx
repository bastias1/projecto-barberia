import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Star, Droplets, Scissors, ShoppingCart } from "lucide-react";
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
        <p className="mb-4 text-lg text-zinc-500 dark:text-zinc-400">Producto no encontrado.</p>
        <Link
          href="/tienda"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const priceLabel = `$${product.precio.toLocaleString("es-CL")}`;
  const imageUrl = product.imagen_url || "/placeholder.png";

  // Parse details if stored as JSON string or array, otherwise use default or split description
  const details = [
    "Calidad profesional garantizada",
    "Ideal para uso diario",
    "Producto exclusivo de Barbería BENJVMIN"
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Link
          href="/tienda"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la tienda
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left Column: Image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
          <Image
            src={imageUrl}
            alt={product.nombre}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col justify-center space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs font-medium uppercase tracking-wider">
                {product.categoria}
              </Badge>
              {product.tag && (
                <Badge className="bg-zinc-900 text-white dark:bg-white dark:text-black border-none">
                  {product.tag}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {product.nombre}
            </h1>
            {product.rating && (
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {product.rating} (Reseñas)
                </span>
              </div>
            )}
          </div>

          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {priceLabel}
          </div>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {product.descripcion}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Disponibilidad:</span>
              <span className={`font-medium ${product.stock > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {product.stock > 0 ? `En Stock (${product.stock})` : "Agotado"}
              </span>
            </div>

            <AddToCartButton
              id={product.id}
              name={product.nombre}
              price={product.precio}
              priceLabel={priceLabel}
              stock={product.stock}
              image={imageUrl}
              fullWidth={true}
              size="lg"
            />
          </div>

          <Card className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 text-zinc-900 dark:text-zinc-100">
                Características destacadas
              </p>
              <ul className="space-y-2">
                {details.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-4 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 mt-4">
                {product.categoria === "Barba" && (
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-3 w-3" /> Hidratación profunda
                  </span>
                )}
                {product.categoria === "Styling" && (
                  <span className="inline-flex items-center gap-1">
                    <Scissors className="h-3 w-3" /> Fijación duradera
                  </span>
                )}
                {product.categoria === "Pack" && (
                  <span className="inline-flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" /> Kit completo
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}