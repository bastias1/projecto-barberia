// app/tienda/[id]/page.tsx

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Star, Droplets, Scissors } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";


const products = [
  {
    id: 1,
    slug: "aceite-barba-classic",
    name: "Aceite para Barba Classic",
    category: "Barba",
    price: "$9.990",
    description:
      "Aceite nutritivo que suaviza la barba, reduce el frizz y deja un aroma masculino clásico y discreto.",
    details: [
      "Formulado para uso diario",
      "Ideal para barbas cortas y medias",
      "No deja sensación grasosa",
    ],
    image: "/products/aceite-barba.jpg",
    tag: "Nuevo",
  },
  {
    id: 2,
    slug: "cera-mate-benjvmin",
    name: "Cera Mate BENJVMIN",
    category: "Styling",
    price: "$11.990",
    description:
      "Cera de fijación media con acabado mate. Perfecta para peinados naturales con textura.",
    details: [
      "No acartona el cabello",
      "Se retira fácilmente con agua",
      "Funciona en cabello corto y medio",
    ],
    image: "/products/cera-mate.jpg",
    tag: "Top venta",
  },
  {
    id: 3,
    slug: "shampoo-barba-cabello",
    name: "Shampoo Barba & Cabello",
    category: "Cuidado",
    price: "$8.490",
    description:
      "Limpieza suave para barba y cabello, pensado para uso frecuente sin resecar la piel.",
    details: [
      "pH balanceado",
      "Reduce picazón y resequedad",
      "Aroma fresco y ligero",
    ],
    image: "/products/shampoo-barba.jpg",
  },
  {
    id: 4,
    slug: "pack-premium-benjvmin",
    name: "Pack Premium BENJVMIN",
    category: "Pack",
    price: "$27.990",
    description:
      "Pack completo con cera, aceite y shampoo BENJVMIN. Ideal para regalo o rutina completa.",
    details: [
      "Incluye 3 productos en formato full size",
      "Mejor relación precio / cantidad",
      "Presentación ideal para regalo",
    ],
    image: "/products/pack-premium.jpg",
    tag: "Edición limitada",
  },
];

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;

  const productId = Number(id);

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 p-4 py-10">
        <main className="mx-auto w-full max-w-3xl text-center">
          <p className="mb-4 text-sm text-zinc-500">Producto no encontrado.</p>
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 p-4 py-10">
      <main className="mx-auto w-full max-w-4xl">
        {/* Barra superior */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la tienda</span>
          </Link>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
              Barbería · Profesional · Premium
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900">
              Detalle de producto
            </h1>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="grid items-start gap-8 md:grid-cols-[1.2fr,1fr]">
          {/* Imagen grande */}
          <Card className="overflow-hidden rounded-3xl border-zinc-200 bg-white shadow-sm">
            <div className="relative h-64 w-full bg-zinc-100 md:h-80">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>
          </Card>

          {/* Info del producto */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {product.category}
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  {product.name}
                </h2>
              </div>
              <div className="text-right">
                {product.tag && (
                  <Badge className="mb-2 border-none bg-violet-100 text-[10px] text-violet-700">
                    {product.tag}
                  </Badge>
                )}
                <div className="inline-flex items-center gap-1 text-xs text-amber-500">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span>4.8</span>
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-zinc-600">
              {product.description}
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs text-zinc-500">Precio</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {product.price}
                </p>
              </div>

            <AddToCartButton
            id={product.id}
            name={product.name}
            priceLabel={product.price}
            image={product.image}
            fullWidth={false}
            />

            </div>

            {/* Características / beneficios */}
            <Card className="mt-4 border-zinc-200 bg-white">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold text-zinc-900">
                  Beneficios principales
                </p>
                <ul className="space-y-1 text-sm text-zinc-600">
                  {product.details?.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Etiquetas visuales según categoría */}
                <div className="flex flex-wrap gap-2 pt-2 text-[11px] text-zinc-500">
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
                      <ShoppingCart className="h-3 w-3" /> Pack completo
                    </span>
                  )}
                </div>
              </CardContent>
            </Card> 
          </div>
        </div>

        {/* Pie simple */}
        <p className="mt-10 text-center text-xs text-zinc-500">
          Esta página representa el detalle de producto del prototipo de
          E-Commerce de Barbería BENJVMIN.
        </p>
      </main>
    </div>
  );
}
