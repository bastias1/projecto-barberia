// lib/cart-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

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
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string | number) => void;
  clearCart: () => void;
  updateQuantity: (id: string | number, quantity: number) => void;
  total: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const exists = state.items.find((i) => i.id === item.id);
          if (exists) {
            // Use the latest stock info passed in, or fallback to existing
            const currentStock = item.stock ?? exists.stock;

            // Check if we can add one more
            if (currentStock !== undefined && exists.quantity >= currentStock) {
              toast.error(`Solo hay ${currentStock} unidades disponibles`);
              return state;
            }

            return {
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, quantity: i.quantity + 1, stock: item.stock } // Update stock with latest value
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
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

      total: () => {
        const { items } = get();
        return items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },
    }),
    {
      name: "cart-storage",
    }
  )
);