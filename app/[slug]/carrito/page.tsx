"use client";

import Link from "next/link";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberia } from "@/components/barberia-provider";
import { RequiereModulo } from "@/components/requiere-modulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";

function formatCLP(value: number) {
  return value.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function CarritoPage() {
  return (
    <RequiereModulo modulo="ecommerce">
      <Carrito />
    </RequiereModulo>
  );
}

function Carrito() {
  const barberia = useBarberia();
  const { items, removeItem, clearCart, updateQuantity } = useBarberiaCart();
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 p-4 py-10">
      <main className="mx-auto w-full max-w-4xl space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <Link
            href={`/${barberia.slug}/tienda`}
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Seguir comprando
          </Link>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">
              Barbería · Profesional · Premium
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900">
              Carrito de compras
            </h1>
          </div>
        </header>

        {/* Carrito vacío */}
        {isEmpty && (
          <Card className="border-zinc-200 bg-white">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-zinc-300" />
              <p className="text-sm text-zinc-600">
                Tu carrito está vacío. Agrega productos desde la tienda.
              </p>
              <Link href={`/${barberia.slug}/tienda`}>
                <Button className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Ir a la tienda
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Carrito con items */}
        {!isEmpty && (
          <>
            <div className="grid gap-6 md:grid-cols-[2fr,1fr] items-start">
              {/* Lista de productos */}
              <Card className="border-zinc-200 bg-white">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base md:text-lg">
                    Productos en tu carrito
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-red-500 hover:text-red-600"
                    onClick={clearCart}
                  >
                    <Trash2 className="h-3 w-3" />
                    Vaciar carrito
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.priceLabel}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Controles de cantidad */}
                        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-xs">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Eliminar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Resumen */}
              <Card className="border-zinc-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    Resumen de compra
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Total productos</span>
                    <span className="font-semibold text-zinc-900">
                      {items.reduce((sum, i) => sum + i.quantity, 0)}{" "}
                      {items.length === 1 ? "artículo" : "artículos"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Total a pagar</span>
                    <span className="text-lg font-bold text-zinc-900">
                      {formatCLP(total)}
                    </span>
                  </div>

                  <Link href={`/${barberia.slug}/checkout`}>
                    <Button className="mt-2 w-full justify-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Ir al checkout
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-xs text-zinc-500">
              Este flujo de carrito y checkout forma parte del prototipo de
              E-Commerce para {barberia.nombre}.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
