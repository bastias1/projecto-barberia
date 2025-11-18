// app/tienda/checkout/page.tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Star, Droplets, Scissors } from "lucide-react";
import { useCartStore } from "../../lib/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutPage() {
  const cart = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Link
          href="/tienda"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a la tienda</span>
        </Link>

        <p className="text-lg sm:text-xl text-zinc-700 dark:text-zinc-300">
          Tu carrito está vacío.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-10">
      <main className="mx-auto w-full max-w-4xl">
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a la tienda</span>
          </Link>
        <br></br>
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Checkout
        </h1>
        <div className="space-y-6">
          {cart.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden rounded-3xl border-2 border-zinc-200 bg-white shadow-sm hover:shadow-xl transition-shadow duration-300 dark:bg-zinc-900 dark:border-zinc-800"
            >
              <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-4">
                {item.image && (
                  <div className="relative h-28 w-28 md:h-32 md:w-32 flex-shrink-0 rounded-xl overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Cantidad: {item.quantity}
                  </p>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {item.quantity} × {item.priceLabel}
                  </p>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Subtotal: ${(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={() => removeItem(item.id)}
                  variant="destructive"
                  className="mt-2 md:mt-0"
                >
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total y botón de pago */}
        <Card className="mt-8 rounded-3xl border-2 border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Total: ${total.toLocaleString()}
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg rounded-xl"
            >
              Pagar
            </Button>
          </CardContent>
        </Card>

        <Button
          onClick={clearCart}
          variant="outline"
          className="mt-6 text-sm text-zinc-500 dark:text-zinc-400"
        >
          Vaciar carrito
        </Button>
      </main>
    </div>
  );
}
