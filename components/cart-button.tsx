"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

export function CartButton() {
  const itemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <Link href="/carrito">
      <Button
        variant="outline"
        size="icon"
        className="relative rounded-full border-zinc-300 hover:border-zinc-500"
      >
        <ShoppingCart className="h-5 w-5" />

        {/* Badge con cantidad */}
        {itemsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {itemsCount}
          </span>
        )}
      </Button>
    </Link>
  );
}
