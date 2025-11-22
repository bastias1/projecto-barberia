"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";

type Props = {
  id: string | number;
  name: string;
  price: number;
  priceLabel: string;
  image?: string;
  fullWidth?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
};

export function AddToCartButton({
  id,
  name,
  price,
  priceLabel,
  image,
  fullWidth = true,
  size = "default",
}: Props) {
  const addItem = useCartStore((state) => state.addItem);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if inside a Link
    addItem({ id, name, price, priceLabel, image });
    console.log("✅ Agregado al carrito:", { id, name, price, priceLabel });
    toast.success("Producto agregado al carrito");
  };

  return (
    <Button
      onClick={handleClick}
      size={size}
      className={`font-medium transition-all active:scale-95 ${fullWidth ? "w-full" : ""
        } ${size === "icon"
          ? "rounded-full h-10 w-10 p-0"
          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md"
        }`}
      type="button"
    >
      <ShoppingCart className={`h-4 w-4 ${size !== "icon" ? "mr-2" : ""}`} />
      {size !== "icon" && "Agregar"}
    </Button>
  );
}
