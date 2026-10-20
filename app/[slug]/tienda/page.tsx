import { notFound } from "next/navigation";
import { getActiveProducts } from "@/lib/services/product-service";
import { getBarberiaCached } from "@/lib/barberia-server";
import { StoreClient } from "./store-client";

export const dynamic = 'force-dynamic';

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const barberia = await getBarberiaCached((await params).slug);
  if (!barberia) notFound();

  const query = (await searchParams).q;
  // Only fetch active products for the public store
  const products = await getActiveProducts(barberia.id_barberia, query);

  return <StoreClient products={products} />;
}
