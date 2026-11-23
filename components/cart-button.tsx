"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberiaHref } from "@/components/barberia-provider";

/** Acceso al carrito con la cantidad de productos; lleva directo a la página del carrito. */
export function CartButton() {
  const { items } = useBarberiaCart();
  const href = useBarberiaHref();
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Button asChild variant="outline" className="relative h-11 gap-2 px-3">
      <Link href={href("/cart")} aria-label={`Carrito, ${itemsCount} ${itemsCount === 1 ? "producto" : "productos"}`}>
        <ShoppingBag className="size-5" aria-hidden="true" />
        <span className="hidden font-medium sm:inline">Carrito</span>
        {itemsCount > 0 && (
          <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
            {itemsCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
