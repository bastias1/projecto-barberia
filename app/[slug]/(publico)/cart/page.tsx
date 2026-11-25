import { notFound } from "next/navigation";
import { getActiveProducts } from "@/lib/services/product-service";
import { getBarberiaCached } from "@/lib/barberia-server";
import { CartClient } from "./cart-client";

export const dynamic = 'force-dynamic';

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
    const barberia = await getBarberiaCached((await params).slug);
    if (!barberia) notFound();

    // Fetch only active products for the carousel (upsell)
    const products = await getActiveProducts(barberia.id_barberia);

    return <CartClient products={products} />;
}
