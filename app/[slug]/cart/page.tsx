import { getActiveProducts } from "@/lib/services/product-service";
import { CartClient } from "./cart-client";

export const dynamic = 'force-dynamic';

export default async function CartPage() {
    // Fetch only active products for the carousel (upsell)
    const products = await getActiveProducts();

    return <CartClient products={products} />;
}
