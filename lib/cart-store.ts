// lib/cart-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { useBarberia } from "@/components/barberia-provider";

export type CartItem = {
  id: string | number;
  name: string;
  price: number;
  priceLabel: string;
  image?: string;
  quantity: number;
  stock: number; // Available stock
};

type CartState = {
  // Barbería dueña de los productos del carrito: un pedido es de una sola barbería
  slug: string | null;
  items: CartItem[];
  addItem: (slug: string, item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string | number) => void;
  clearCart: () => void;
  updateQuantity: (id: string | number, quantity: number) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      slug: null,
      items: [],

      addItem: (slug, item) =>
        set((state) => {
          // Al comprar en otra barbería se empieza un carrito nuevo
          const items = state.slug === slug ? state.items : [];
          const exists = items.find((i) => i.id === item.id);
          if (exists) {
            // Use the latest stock info passed in, or fallback to existing
            const currentStock = item.stock ?? exists.stock;

            // Check if we can add one more
            if (currentStock !== undefined && exists.quantity >= currentStock) {
              toast.error(`Solo hay ${currentStock} unidades disponibles`);
              return state;
            }

            return {
              slug,
              items: items.map((i) =>
                i.id === item.id
                  ? { ...i, quantity: i.quantity + 1, stock: item.stock } // Update stock with latest value
                  : i
              ),
            };
          }
          return {
            slug,
            items: [...items, { ...item, quantity: 1 }],
          };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      clearCart: () => set({ items: [] }),

      updateQuantity: (id, quantity) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item && item.stock !== undefined && quantity > item.stock) {
            toast.error(`Solo hay ${item.stock} unidades disponibles`);
            return state;
          }
          return {
            items: state.items
              .map((i) =>
                i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
              )
              .filter((i) => i.quantity > 0),
          };
        }),
    }),
    {
      name: "cart-storage",
    }
  )
);

const SIN_ITEMS: CartItem[] = [];

/** Carrito de la barbería actual (vacío si lo guardado es de otra barbería). */
export function useBarberiaCart() {
  const { slug } = useBarberia();
  const cartSlug = useCartStore((state) => state.slug);
  const storedItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  const items = cartSlug === slug ? storedItems : SIN_ITEMS;
  return {
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem: (item: Omit<CartItem, "quantity">) => addItem(slug, item),
    removeItem,
    updateQuantity,
    clearCart,
  };
}
