import { getProducts } from "@/lib/services/product-service";
import { CartClient } from "./cart-client";

export const dynamic = 'force-dynamic';

export default async function CartPage() {
    // Fetch products for the carousel (upsell)
    const products = await getProducts();

    return <CartClient products={products} />;
}
