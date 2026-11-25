import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/services/product-service";
import { getBarberiaCached } from "@/lib/barberia-server";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function ProductPage({ params }: PageProps) {
  const { slug, id } = await params;
  const barberia = await getBarberiaCached(slug);
  if (!barberia) notFound();

  const product = await getProductById(barberia.id_barberia, Number(id));

  if (!product) {
    return (
      <main id="contenido" className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
        <h1 className="display mb-2 text-3xl">Producto no encontrado</h1>
        <p className="mb-6 text-muted-foreground">Puede que ya no esté disponible.</p>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/${slug}/tienda`}><ArrowLeft className="size-4" aria-hidden="true" />Volver a la tienda</Link>
        </Button>
      </main>
    );
  }

  const priceLabel = `$${product.precio.toLocaleString("es-CL")}`;
  const imageUrl = product.imagen_url || "/placeholder.svg";
  const agotado = product.stock <= 0;

  return (
    <main id="contenido">
      <Button asChild variant="ghost" className="-ml-3 mb-4 h-11 gap-2">
        <Link href={`/${slug}/tienda`}><ArrowLeft className="size-4" aria-hidden="true" />Volver a la tienda</Link>
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
          <Image src={imageUrl} alt={product.nombre} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" priority />
        </div>

        <div className="flex flex-col justify-center gap-6">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {product.categoria}
              {product.tag && <span className="ml-2 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{product.tag}</span>}
            </p>
            <h1 className="display text-3xl sm:text-4xl">{product.nombre}</h1>
          </div>

          <p className="tabular text-3xl font-semibold">{priceLabel}</p>

          {product.descripcion && <p className="leading-relaxed text-muted-foreground">{product.descripcion}</p>}

          <div className="space-y-4 border-t border-border pt-5">
            <p className="text-sm">
              <span className="text-muted-foreground">Disponibilidad: </span>
              <span className="font-medium">{agotado ? "Agotado" : product.stock <= 5 ? `Quedan ${product.stock}` : "En stock"}</span>
            </p>
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
        </div>
      </div>
    </main>
  );
}
