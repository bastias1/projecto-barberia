"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBarberiaCart } from "@/lib/cart-store";
import { toast } from "sonner";

type Props = {
  id: string | number;
  name: string;
  price: number;
  priceLabel: string;
  stock: number;
  image?: string;
  fullWidth?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
};

export function AddToCartButton({
  id,
  name,
  price,
  priceLabel,
  stock,
  image,
  fullWidth = true,
  size = "default",
}: Props) {
  const { addItem } = useBarberiaCart();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if inside a Link
    addItem({ id, name, price, priceLabel, stock, image });
    toast.success("Producto agregado al carrito");
  };

  return (
    <Button
      onClick={handleClick}
      size={size}
      disabled={stock <= 0}
      className={`h-11 font-medium active:scale-[0.98] ${fullWidth ? "w-full" : ""} ${size === "icon" ? "w-11 p-0" : ""}`}
      type="button"
    >
      <ShoppingBag className="size-4" aria-hidden="true" />
      {size === "icon" ? <span className="sr-only">Agregar al carrito</span> : stock <= 0 ? "Agotado" : "Agregar"}
    </Button>
  );
}
