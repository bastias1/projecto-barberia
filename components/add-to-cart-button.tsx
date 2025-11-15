"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

type Props = {
  id: number;
  name: string;
  price: number;
  priceLabel: string;
  image?: string;
  fullWidth?: boolean;
};

export function AddToCartButton({
  id,
  name,
  price,        
  priceLabel,
  image,
  fullWidth = true,
}: Props) {
  const addItem = useCartStore((state) => state.addItem);

  const handleClick = () => {
    addItem({ id, name, price, priceLabel, image });
    console.log("✅ Agregado al carrito:", { id, name, price, priceLabel });
    alert("Producto agregado al carrito (demo)");
  };

  return (
    <Button
      onClick={handleClick}
      className={`cursor-pointer justify-center gap-2 text-sm ${
        fullWidth ? "w-full" : ""
      }`}
      type="button"
    >
      <ShoppingCart className="h-4 w-4" />
      Agregar al carrito
    </Button>
  );
}