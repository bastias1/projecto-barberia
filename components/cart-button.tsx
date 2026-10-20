"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberiaHref } from "@/components/barberia-provider";

export function CartButton() {
  const { items, removeItem, total } = useBarberiaCart();
  const href = useBarberiaHref();
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Botón del carrito */}
      <Button
        variant="outline"
        className="relative rounded-full hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all duration-300 px-4 gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="font-medium">Carrito</span>
        {itemsCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {itemsCount}
          </span>
        )}
      </Button>

      {/* PREVIEW DESPLEGABLE */}
      {open && (
        <Card className="absolute right-0 top-14 w-80 sm:w-96 shadow-2xl z-50 border-2 border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="p-0">
            {/* Encabezado */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Tu Carrito
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Items */}
            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
              {items.length === 0 && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  Tu carrito está vacío.
                </p>
              )}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800"
                >
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    width={60}
                    height={60}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {item.priceLabel} × {item.quantity}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs h-8"
                    onClick={() => removeItem(item.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>

            {/* Total + checkout */}
            {items.length > 0 && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Total:
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ${total.toLocaleString("es-CL")}
                  </span>
                </div>
                <Link href={href("/cart")} className="block">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300"
                    onClick={() => setOpen(false)}
                  >
                    Ver Carrito
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}