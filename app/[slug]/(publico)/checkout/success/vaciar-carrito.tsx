"use client";

import { useEffect } from "react";
import { useBarberiaCart } from "@/lib/cart-store";

/** El pago ya se aprobó: vacía el carrito de esta barbería. */
export function VaciarCarrito() {
    const { clearCart } = useBarberiaCart();
    useEffect(() => {
        clearCart();
    }, [clearCart]);
    return null;
}
