import { getProducts } from "@/lib/services/product-service";
import { StoreClient } from "./store-client";

export const dynamic = 'force-dynamic';

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q;
  const products = await getProducts(query);

  return <StoreClient products={products} />;
}
