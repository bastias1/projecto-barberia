"use client"

import { CartButton } from "@/components/cart-button";
import { SearchInput } from "@/components/shop/search-input";
import { BarberiaNavbar } from "@/components/barberia-navbar";

export function StoreHeader() {
    return (
        <BarberiaNavbar ancho="max-w-6xl" acciones={<CartButton />}>
            <SearchInput />
        </BarberiaNavbar>
    );
}
