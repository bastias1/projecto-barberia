import { getActiveProducts } from "@/lib/services/product-service";
import { StoreClient } from "./store-client";

export const dynamic = 'force-dynamic';

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q;
  // Only fetch active products for the public store
  const products = await getActiveProducts(query);

  return <StoreClient products={products} />;
}
